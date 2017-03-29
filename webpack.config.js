var webpack = require('webpack');

module.exports = {
	entry: ['babel-polyfill', './main.js'],
	output: {
		path: './',
		filename: 'index.js'
	},
	devServer: {
		inline: true,
		port: 3333,
		host: '0.0.0.0',
		devtool: "eval",
	},
	worker: {
		output: {
			filename: 'hash.worker.js',
			chunkFilename: '[id].hash.worker.js'
		}
	},
	module: {
		loaders: [
			{
				test: /\.jsx?$/,
				exclude: [/node_modules/, /lib/],
				loader: 'babel',
				query: {
					presets: ['es2015', "stage-0"]
				}
			},
			{ test: /\.css$/, loader: "style-loader!css-loader" },
      {
        test   : /\.(ttf|eot|svg|woff(2)?)(\?[a-z0-9]+)?$/,
        loader : 'file-loader'
      },
     	{
        test: /.html$/,
        loader: 'html-loader'
      }
		]
	},
	plugins: [
    new webpack.ProvidePlugin({
        d3: 'd3'
    })
 ]
}