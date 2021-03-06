/**
 * THREE Bundles - Binary Encoder/Decoder Test Suite
 * Copyright (C) 2015 Ioannis Charalampidis <ioannis.charalampidis@cern.ch>
 * 
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * @author Ioannis Charalampidis / https://github.com/wavesoft
 */

global.PROD = true;

var assert = require('assert');
var path = require('path');
var temp = require('temp');
var fs = require('fs');
var mute = require('mute');
var common = require('./utils/common');
var compare = require('./utils/compare');
var JBBSourceLoader = require('../loader');
var JBBBinaryLoader = require('../decoder');
var JBBProfileThreeLoader = require('jbb-profile-three/profile-loader');
var THREEEncodeProfile = require('jbb-profile-three/profile-encode');
var THREEDecodeProfile = require('jbb-profile-three/profile-decode');
var BinaryCompiler = require('../compiler');
require('./utils/common').static(global);
require('./utils/tests').static(global);

////////////////////////////////////////////////////////////////
// Initialization
////////////////////////////////////////////////////////////////

// Path to media folder
var mediaDir = path.join(__dirname, 'media');

// Prepare a fake browser
var MockBrowser = require('mock-browser').mocks.MockBrowser;
var mock = new MockBrowser();

// Fake 'self', 'document' and 'window'
global.document = mock.getDocument(),
global.self = MockBrowser.createWindow(),
global.window = global.self;

// Fake 'XMLHttpRequest' (shall not be used)
global.XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

// Fake Blob
global.Blob = function(url) { };
global.URL = { createObjectURL: function(blob) { return ""; } };

// Initialize environment for node.js
JBBProfileThreeLoader.initialize();

////////////////////////////////////////////////////////////////
// Helper Functinos
////////////////////////////////////////////////////////////////

/**
 * Closure for repeating the test with different bundles
 */
function describe_clojure( bundleName, testFn ) {
	return function() {
		var srcDB, binDB, tmpFile, sourceLoadingTime, binaryLoadingTime;

		it('should properly load the source bundle', function( done ) {

			/* Load the source bundle */
			var unmute = mute();
			var sourceLoader = new JBBSourceLoader( mediaDir );
			sourceLoadingTime = Date.now();
			sourceLoader.addProfileLoader( JBBProfileThreeLoader )
			sourceLoader.add( bundleName );
			sourceLoader.load(function( err ) {
				unmute();
				assert.ok( err == null, err );
				sourceLoadingTime = Date.now() - sourceLoadingTime;

				/* Keep the database for the next test */
				srcDB = sourceLoader.database;
				done();

			});

		});
		it('should properly compile the bundle', function( done ) {

			/* This can take long time. Give it 2 minutes. */
			this.timeout(120000);

			/* Create a temporary file to compile */
			var unmute = mute();
			tmpFile = path.join(__dirname, bundleName+'.tmp');// temp.path({suffix: '.test'});
			BinaryCompiler.compileFile( path.join(mediaDir, bundleName+'.jbbsrc'), tmpFile, {
					'path'			: mediaDir,
					'log'			: 0x8000,
					'profileEncoder': THREEEncodeProfile,
					'profileLoader'	: JBBProfileThreeLoader,
					'sparse'		: false
				}, function( err ) {
					unmute();

					tmpFile += ".jbb";
					assert.ok( fs.existsSync( tmpFile ), 'bundle file was not created' );
					assert.ok( err == null, err );

					/* Loaded */
					done();

				}
			);

		});
		it('should properly load the binary bundle on time', function( done ) {

			/* Load the source bundle */
			var unmute = mute();
			var binaryLoader = new JBBBinaryLoader( path.dirname(tmpFile) );
			binaryLoadingTime = Date.now();
			binaryLoader.addProfile( THREEDecodeProfile );
			binaryLoader.addByBuffer( common.readChunk(tmpFile) );
			binaryLoader.load(function( err ) {
				unmute();
				assert.ok( err == null, err );
				binaryLoadingTime = Date.now() - binaryLoadingTime;

				/* Delete bundle */
				fs.unlink( tmpFile );

				/* Keep the database for the next test */
				binDB = binaryLoader.database;
				done();

			});

		});
		it('should be encoded correctly', function(done) {

			/* This is not optimized, can take up to 10 seconds. */
			this.timeout(10000);

			assert.deepEqual( Object.keys(srcDB).sort(), Object.keys(binDB).sort(), 'database keys must be the same' );

			testFn( srcDB, binDB );
			done();

		});
		it('should be loaded faster than the source bundle', function(done) {
			// Give a tollerance of 5 ms
			if (binaryLoadingTime > sourceLoadingTime + 5) {
				var percent = 100 * (binaryLoadingTime - sourceLoadingTime) / sourceLoadingTime;
				assert.ok( binaryLoadingTime < sourceLoadingTime, 'binary bundle loaded slower (by ' + percent.toFixed(2) + ' %)' );
			}
			done();
		});

	};
}

////////////////////////////////////////////////////////////////
// Test Entry Point
////////////////////////////////////////////////////////////////

// Profiled encoding/decoding
describe('[THREE.js Profile Tests]', function() {

	var commonIgnoredKeys = [
		// Functions
		'onChangeCallback',
		'constructor',
		'set',
		 // OK To change
		'uuid',
		'parent',
		// Pointless to compare
		'solid',
		'image',
		'version',
	];

	describe('animated.jbbsrc', describe_clojure( 'animated', function( original, encoded ) {

		// Configuration for explicit deep equal
		var config = {
			ignoreKeys: commonIgnoredKeys,
			ignoreClasses: [ ],
			numericTollerance: 0.0001
		};

		// Explicit deep equal comparison
		compare.explicitDeepEqual( original['animated/flamingo'], 
								   encoded['animated/flamingo'], 
								   'in animated/flamingo', config );
		compare.explicitDeepEqual( original['animated/horse'], 
								   encoded['animated/horse'], 
								   'in animated/horse', config );
		compare.explicitDeepEqual( original['animated/monster'], 
								   encoded['animated/monster'], 
								   'in animated/monster', config );

	}));

	describe('vrml.jbbsrc', describe_clojure( 'vrml', function( original, encoded ) {

		// Configuration for explicit deep equal
		var config = {
			ignoreKeys: commonIgnoredKeys,
			ignoreClasses: [ ],
			numericTollerance: 0.001
		};

		// Explicit deep equal comparison
		compare.explicitDeepEqual( original['vrml/house'], 
								   encoded['vrml/house'], 
								   'in vrml/house', config );

	}));

	describe('md2.jbbsrc', describe_clojure( 'md2', function( original, encoded ) {

		// Configuration for explicit deep equal
		var config = {
			ignoreKeys: commonIgnoredKeys,
			ignoreClasses: [ ],
			numericTollerance: 0.001
		};

		// Explicit deep equal comparison
		compare.explicitDeepEqual( original['md2/ratamahatta'], 
								   encoded['md2/ratamahatta'], 
								   'in md2/ratamahatta', config );

	}));

	describe('heavy.jbbsrc', describe_clojure( 'heavy', function( original, encoded ) {

		// Configuration for explicit deep equal
		var config = {
			ignoreKeys: commonIgnoredKeys,
			ignoreClasses: [ ],
			numericTollerance: 0.001
		};

		// Explicit deep equal comparison
		compare.explicitDeepEqual( original['heavy/hand'], 
								   encoded['heavy/hand'], 
								   'in heavy/hand', config );

		// Explicit deep equal comparison
		compare.explicitDeepEqual( original['heavy/ben'], 
								   encoded['heavy/ben'], 
								   'in heavy/ben', config );

	}));

	describe('obj.jbbsrc', describe_clojure( 'obj', function( original, encoded ) {

		// Configuration for explicit deep equal
		var config = {
			ignoreKeys: commonIgnoredKeys,
			ignoreClasses: [ ],
			numericTollerance: 0.001
		};

		// Explicit deep equal comparison
		compare.explicitDeepEqual( original['obj/walthead'], 
								   encoded['obj/walthead'], 
								   'in obj/walthead', config );

	}));

});
