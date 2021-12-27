; (async () => {
	'use strict';

	// Deps
	const fs = require('fs-extra');
	const sharp = require('sharp');
	const { join } = require('path');
	const { sync: { zip } } = require('zip-local');

	// Constants
	const buildFolder = 'build';
	const localeFolder = '_locales';
	const iconFilename = 'icon.svg';
	const packageJson = 'package.json';
	const filesToCopy = ['README.md', 'LICENSE.md', 'manifest.json', 'background.js', '_locales'];

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

	// Generate zip filenames based on the extension name and version
	const getZipFileName = () => {
		return extensionName + '-' + extensionVersion + '.zip';
	};

	// Generate zip files
	const zipBuildFolders = async () => {
		try {
			zip(buildFolder).compress().save(join(buildFolder, getZipFileName()));

			continueBuild('Files zipped');
		} catch (error) {
			cancelBuild('Error while zipping files', error);
		}
	};

	// Generate extension icons in multiple sizes
	const generateIcons = async () => {
		try {
			await Promise.all([128, 64, 48, 32, 16].map(size => {
				return sharp(iconFilename)
					.resize(size, size)
					.png({
						compressionLevel: 9,
						adaptiveFiltering: true,
						palette: true
					})
					.toFile(join(buildFolder, `${size}.png`));
			}));

			continueBuild('Icons generated');
		} catch (error) {
			cancelBuild('Error while generating icons', error);
		}
	};

	// Copy files to build folder
	const copyFiles = async () => {
		const copyPromises = filesToCopy.map(filename => {
			return fs.copy(filename, join(buildFolder, filename));
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

			continueBuild('Cleaned build folder');
		} catch (error) {
			cancelBuild('Error while cleaning build folder', error);
		}
	};

	await getExtensionDetails();
	await cleanBuildFolder();
	await copyFiles();
	await generateIcons();
	await zipBuildFolders();

	console.log();
	continueBuild('BUILD COMPLETE (' + new Date().toLocaleTimeString() + ')\n');
})();
