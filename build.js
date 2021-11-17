; (async () => {
	'use strict';

	// Deps
	const fs = require('fs-extra');
	const imagemin = require('imagemin');
	const optiPng = require('imagemin-optipng');
	const replace = require('replace-in-file');
	const { join } = require('path');
	const { sync: { zip } } = require('zip-local');

	// Constants
	const buildFolder = 'build';
	const chromiumSubfolder = join(buildFolder, 'chromium');
	const localeFolder = '_locales';
	const filesToCopy = ['README.md', 'LICENSE.md', 'manifest.json', 'background.js', '_locales'];
	const packageJson = 'package.json';

	// Runtime
	let extensionName;
	let extensionVersion;


	// Shows a success message
	const continueBuild = async (msg) => {
		console.log('✓', msg);
	};

	// Stops the build and shows an error messages
	const cancelBuild = async (msg, error) => {
		console.error('✗', msg);
		console.error(error);

		process.exit(1);
	};

	// Get extension name and version from package.json
	const getExtensionDetails = async () => {
		try {
			const packageObj = await fs.readJson(packageJson);

			extensionName = packageObj.name;
			extensionVersion = packageObj.version.replace('.0', '');
		} catch (error) {
			cancelBuild('Error while getting the extension details from ' + packageJson, error);
		}

		continueBuild('Starting build of ' + extensionName + ' v' + extensionVersion);
	};

	// Generate zip filenames based on the extension name, version, and variant
	const getZipFileName = (extensionVariant) => {
		return extensionName + '-' + extensionVersion + '-' + extensionVariant + '.zip';
	};

	// Generate zip files
	const zipBuildFolders = async () => {
		try {
			zip(chromiumSubfolder).compress().save(join(buildFolder, getZipFileName('chromium')));

			continueBuild('Files zipped');
		} catch (error) {
			cancelBuild('Error while zipping files', error);
		}
	};

	// Compress images
	const compressImages = async () => {
		try {
			const result = await imagemin(['img/*.png'], {
				destination: join(chromiumSubfolder, 'img'),
				plugins: [
					optiPng({
						optimizationLevel: 7
					})
				]
			});

			if (!result || result.length == 0) {
				throw new Error('No images were found');
			}

			continueBuild('Images compressed');
		} catch (error) {
			cancelBuild('Error while compressing images', error);
		}
	};

	// Copy files to build folder
	const copyFiles = async () => {
		const copyPromises = filesToCopy.map(filename => {
			return fs.copy(filename, join(chromiumSubfolder, filename));
		});

		try {
			await Promise.all(copyPromises);

			continueBuild('Files copied');
		} catch (error) {
			cancelBuild('Error while copying files', error);
		}
	};

	// Create a build folder if it doesn't exist already, otherwise empty it
	const cleanBuildFolder = async () => {
		try {
			await fs.emptyDir(buildFolder);
			await fs.emptyDir(chromiumSubfolder);

			continueBuild('Cleaned build folder');
		} catch (error) {
			cancelBuild('Error while cleaning build folder', error);
		}
	};

	// Generate complete store listing descriptions from localized messages
	const generateStoreListings = async () => {
		const localeCodes = (() => fs.readdirSync(localeFolder).filter(filename => fs.statSync(join(localeFolder, filename)).isDirectory()))();

		if (localeCodes !== null) {
			localeCodes.forEach(localeCode => {
				const messages = JSON.parse(fs.readFileSync(join(localeFolder, localeCode, 'messages.json')));
				const listingText = Object.keys(messages)
					.filter(key => key.substring(0, 5) === 'store')
					.map(key => messages[key].message)
					.join('\n\n');

				fs.writeFile(join(buildFolder, 'store-listing-' + localeCode + '.txt'), listingText, error => {
					if (error) {
						cancelBuild('Error while generating store listings for' + localeCode.toUpperCase(), error);
					} else {
						continueBuild('Store listing generated for ' + localeCode.toUpperCase());
					}
				});
			});
		}
	};

	await getExtensionDetails();
	await cleanBuildFolder();
	await copyFiles();
	await compressImages();
	await zipBuildFolders();
	await generateStoreListings();

	console.log();
	continueBuild('BUILD COMPLETE (' + new Date().toLocaleTimeString() + ')\n');
})();
