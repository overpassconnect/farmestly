const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const dotenv = require('dotenv'); // Add this

// stergios - May 2025 - Overpassconnect

const ASSETS_FOLDER_NAME = 'assets';  // Will be the same inside src relative root and in build root!
const SRC_RELATIVE_ROOT = 'src';	  // Location of the source files rerlative to the project root i.e. where the webpack.config.js is run from

module.exports = (env, argv) => {
	const isProduction = argv.mode === 'production';
	const buildRoot = env.buildroot || path.resolve(__dirname, 'dist');

	//////////////////////// Load environment variables
	const envFile = isProduction ? '.env.production' : '.env.development';
	const fallbackEnvFile = '.env';

	// Try to load specific env file first, then fallback to .env
	let envVars = {};

	// Try environment-specific file first
	let result = dotenv.config({ path: envFile });

	// Check if there was an error OR no variables were parsed
	if (result.error || !result.parsed || Object.keys(result.parsed).length === 0) {
		console.log('.env Fallback! Reason:', result.error ? result.error.message : 'No variables found');
		// Fallback to .env
		result = dotenv.config({ path: fallbackEnvFile });
		console.log('Fallback result:', result);
	}

	envVars = result.parsed || {};

	// / Filter and create client environment variables
	const clientEnvVars = Object.keys(envVars)
		.filter(key => key.startsWith('REACT_'))
		.reduce((acc, key) => {
			acc[`process.env.${key}`] = JSON.stringify(envVars[key]);
			return acc;
		}, {});

	// Add NODE_ENV
	clientEnvVars['process.env.NODE_ENV'] = JSON.stringify(isProduction ? 'production' : 'development');

	// Debug what's being defined
	console.log('Environment variables being defined:');
	console.log(clientEnvVars);
	//////////////////////////


	return {
		entry: path.resolve(__dirname, SRC_RELATIVE_ROOT, 'index.js'),
		output: {
			path: buildRoot,
			publicPath: '/',  // This forces absolute paths
			filename: isProduction ? 'bundle.[contenthash].js' : 'bundle.js',
			clean: true, // Clean the output directory before emit
		},
		module: {
			rules: [
				{
					test: /\.jsx?$/,
					exclude: /node_modules/,
					use: {
						loader: 'babel-loader',
						options: {
							presets: [
								'@babel/preset-env',
								['@babel/preset-react', { runtime: 'automatic' }]
							],
						},
					},
				},
				{
					test: /\.(png|jpe?g|gif|svg)$/,
					type: 'asset/resource',
					generator: {
						filename: ASSETS_FOLDER_NAME + '/[name][ext]',
					},
				},
				// Regular CSS files (not modules)
				{
					test: /\.css$/,
					exclude: /\.module\.css$/,
					use: ['style-loader', 'css-loader'],
				},
				// CSS Modules
				{
					test: /\.module\.css$/i,
					use: [
						'style-loader',
						{
							loader: 'css-loader',
							options: {
								modules: {
									localIdentName: isProduction
										? '[hash:base64:12]'
										: '[local]_[hash:base64:8]',
								},
								// namedExport: false,  used to avoid import * as styles from but gives error??
								url: {
									filter: (url) => {
										// Don't process URLs that start with /assets/ for use in url() in css for example!
										return !url.startsWith('/' + ASSETS_FOLDER_NAME + '/');
									},
								}
							},
						}
					],
				},
			],
		},
		resolve: {
			extensions: ['.js', '.jsx'],
		},
		plugins: [
			new HtmlWebpackPlugin({
				template: path.resolve(__dirname, SRC_RELATIVE_ROOT, 'index.html'),
			}),
			new CopyPlugin({
				patterns: [
					{
						from: path.resolve(__dirname, SRC_RELATIVE_ROOT, ASSETS_FOLDER_NAME),
						to: path.join(buildRoot, ASSETS_FOLDER_NAME),
						noErrorOnMissing: true // very important to avoid webpack errors when the assets folder is empty
					}
				],
			}),
			new webpack.DefinePlugin(clientEnvVars)
		],
	};
};
