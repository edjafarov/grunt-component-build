/*jshint node:true */
/*
 * grunt-component
 * https://github.com/anthonyshort/grunt-component-build
 *
 * Copyright (c) 2012 Anthony Short
 * Licensed under the MIT license.
 */

'use strict';

var Builder = require('component-builder');
var fs = require('fs');
var path = require('path');
var template = fs.readFileSync(__dirname + '/../lib/require.tmpl').toString();
var requirejs = require('component-require');

module.exports = function(grunt) {

  // Please see the grunt documentation for more information regarding task and
  // helper creation: https://github.com/cowboy/grunt/blob/master/docs/toc.md

  // ==========================================================================
  // TASKS
  // ==========================================================================

  grunt.registerMultiTask('component_constructor', 'component-build for grunt.', function() {
    var self = this;
    var opts = this.options();
    var name = opts.name || this.target;
    var verbose = opts.verbose;
    var dir = path.resolve(opts.base || '');
    var output = path.resolve(opts.output);
    var done = this.async();

    var verboseLog = function(str) {
      if (verbose) {
        grunt.log.writeln(str);
      }
    };
    if(opts.config){
      var compConfig = {
        name: opts.config.name,
        main: opts.config.main,
        version: opts.config.version,
        license: opts.config.license,
        dependencies: opts.config.dependencies
      };
      ['images','fonts','scripts','styles','templates'].forEach(function(asset){
        if(opts.config[asset]){
          compConfig[asset] = grunt.file.expand(opts.config[asset]);
        }
      });
      var json = Builder.prototype.json;
      Builder.prototype.json = function(){
        Builder.prototype.json = json;
        return compConfig;
      }
    }

    // The component builder
    var builder = new Builder(dir);

    // Where to output the final file
    builder.copyAssetsTo(output);

    // Prefix urls
    if (opts.prefix) {
      builder.prefixUrls(opts.prefix);
    }

    // Development mode
    if (opts.dev) {
      builder.development();
    }

    if (opts.sourceUrls === true) {
      builder.addSourceURLs();
    }

    // Ignore component parts
    if (opts.ignore) {
      Object.keys(opts.ignore).forEach(function(n) {
        var type = opts.ignore[n];
        builder.ignore(n, type);
      });
    }

    // By default Builder takes the paths of the dependencies
    // from the current directory (here the Gruntfile path).
    // So in case the dependencies are not stored in the /components
    // but in the baseOption/components, we have to add it to the lookup.
    builder.addLookup(path.join(dir, 'components'));

    // The component config
    var componentJsonPath = path.join(dir, 'component.json');
    var config = builder.config || {};
    if(fs.existsSync(componentJsonPath)){
      config = require(componentJsonPath);
    }

    if (config.paths) {
      config.paths = config.paths.map(function(p) {
        return path.resolve(dir, p);
      });

      builder.addLookup(config.paths);
    }

    // Set the config on the builder. We've modified
    // the original config from the file and this will
    // override settings during the build
    builder.config = config;

    // Configure hook
    if (opts.configure) {
      opts.configure.call(this, builder);
    }

    var start = new Date();

    if(!opts.assetType){
      // Build the component
      builder.build(function(err, obj) {
        if (err) {
          grunt.log.error(err.message);
          grunt.fatal(err.message);
        }

        verboseLog('duration: ' + (new Date() - start) + 'ms');

        writeCSS(obj.css);
        writeJS(obj.js);

        done();
      });
    }
    if(opts.assetType == 'styles'){
      builder.buildStyles(function(err, obj){
        if (err) {
          grunt.log.error(err.message);
          grunt.fatal(err.message);
        }
       writeCSS(obj);
       done();
      });
    }

    if(opts.assetType == 'templates' || opts.assetType == 'scripts'){
      builder.buildScripts(function(err, scripts){
        builder.buildAliases(function(err, aliases){
          builder.buildTemplates(function(err, templates){
            var obj = [scripts, aliases, templates, builder._js].filter(empty).join('\n');
            if (err) {
              grunt.log.error(err.message);
              grunt.fatal(err.message);
            }
            writeJS(obj);
            done();
          });
        })
      });
    }

    function empty(s) {
      return '' != s;
    }

    function writeCSS(obj){
       // Write CSS file
      if (opts.styles !== false) {
        var cssFile = path.join(output, name + '.css');
        grunt.file.write(cssFile, obj.trim());
        verboseLog('write: ' + path.join(opts.output, name + '.css') + ' (' + (obj.trim().length / 1024 | 0) + 'kb)');
      }
    }

    function writeJS(obj){
        // Write JS file
      if (opts.scripts !== false) {
        var jsFile = path.join(output, name + '.js');
        var size = 0;
        grunt.file.write(jsFile, requirejs + obj);
        size = requirejs.length + obj.length;
        verboseLog( 'write: ' + path.join(opts.output, name + '.js') + ' (' + ( size / 1024 | 0 ) + 'kb)' );
      }
    }
  });
};
