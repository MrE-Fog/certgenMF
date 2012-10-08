//
// certgen.js
//
// Copyright (c) Bich C. Le, all rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var tmp = require('tmp');
var fs = require('fs');
var child = require('child_process');

/*
 * Create a certificate request configuration file.
 * opts: file creation options. 'prefix' sets file prefix.
 *       'keep' instructs whether to keep the file upon process exit. 
 * hash: a hash of key value pairs to enter into the config file
 * cb: a callback of the form cb(err, path), where path is the path
 *     of the certificate request file, if successful.
 */
exports.create_cert_request_config = function (opts, hash, cb) {
  var s = "[ req ]\ndefault_bits           = 1024\n" +
    "default_keyfile        = keyfile.pem\n" +
    "distinguished_name     = req_distinguished_name\n" +
    "prompt                 = no\n\n" +
    "[ req_distinguished_name ]\n";

  var allowableKeys = { C:1, ST:1, L:1, O:1, OU:1, CN:1 };
  Object.keys(hash).forEach(function (key) {
    if (key in allowableKeys) {
      var val = hash[key];
      if (Array.isArray(val))
        val = val[0]; // hack to handle OUs that are arrays of strings
      s = s + key + " = " + val + "\n";
    }
  });

  tmp.file(opts, function tmpFileCb(err, path) {
    if (err) return cb(err);
    fs.writeFile(path, s, function writeFileCb(err) {
      cb(err, path);
    });
  });
}

/*
 * Create a keypair.
 * opts: file creation options. 'prefix' sets file prefix.
 *       'keep' instructs whether to keep the file upon process exit. 
 * cb: a callback of the form cb(err, path), where path is the path
 *     of the created file, if successful.
 */
exports.create_keypair = function (opts, cb) {
  tmp.file(opts, function tmpFileCb(err, path) {
    if (err) return cb(err);
    child.exec('openssl genrsa -out ' + path + ' 1024', function execCb(err) {
      cb(err, path);
    });
  });  
}

/*
 * Create a certification request.
 * opts: file creation options. 'prefix' sets file prefix.
 *       'keep' instructs whether to keep the file upon process exit. 
 * keyPath: the file containing the subject's public key
 * cfgPath: the request configuration file
 * cb: a callback of the form cb(err, path), where path is the path
 *     of the created file, if successful.
 */
exports.create_cert_request = function (opts, keyPath, cfgPath, cb) {
  tmp.file(opts, function tmpFileCb(err, path) {
    if (err) return cb(err);
    child.exec('openssl req -new -key ' + keyPath + ' -config ' + cfgPath + ' -out ' + path,
               function execCb(err) {
      cb(err, path);
    });
  });    
}

/*
 * Create a signed certificate from request file.
 * opts: file creation options. 'prefix' sets file prefix.
 *       'keep' instructs whether to keep the file upon process exit. 
 * reqPath: the certification request file
 * caKeyPath: the signer's key
 * caCertPath: the signer's certificate
 * cb: a callback of the form cb(err, path), where path is the path
 *     of the created file, if successful.
 */
exports.create_cert = function (opts, reqPath, caKeyPath, caCertPath, cb) {
  tmp.file(opts, function tmpFileCb(err, path) {
    if (err) return cb(err);
    child.exec('openssl x509 -req -in ' + reqPath + ' -CAkey ' + caKeyPath + ' -CA ' +
                caCertPath + ' -out ' + path + ' -CAcreateserial',
                function execCb(err) {
      cb(err, path);
    });
  });    
}

/*
 * Generate a signed certificate from supplied information.
 * prefix: Temporary file prefix. 
 * keepFiles: Whether to keep generated files upon process exit.
 * hash: Object containing subject's distinguished name information
 * caKeyPath: the signer's key
 * caCertPath: the signer's certificate
 * cb: a callback of the form cb(err, keyPath, certPath)
 */
exports.generate_cert = function (prefix, keepFiles, hash, caKeyPath, caCertPath, cb) {
  
  var opts = { keep:keepFiles, prefix:prefix + '-', postfix:'.pem'}
  exports.create_keypair(opts, function(err, keyPath) {
    if (err) return cb(err);
    opts.postfix = '.cfg';
    exports.create_cert_request_config(opts, hash, function (err, cfgPath) {
      if (err) return cb(err);
      opts.postfix = '.pem';
      opts.prefix = prefix + '-csr-';
      exports.create_cert_request(opts, keyPath, cfgPath, function (err, reqPath) {
        if (err) return cb(err);
        opts.prefix = prefix + '-cert-';
        exports.create_cert(opts, reqPath, caKeyPath, caCertPath, function (err, certPath) {
          cb(err, keyPath, certPath);
        });
      });
    });  
  });  
}

/*
 * Same as generate_cert, except that key and certificate contents are returned
 * as buffers instead of paths.
 * 
 * prefix: Temporary file prefix. 
 * keepFiles: Whether to keep generated files upon process exit.
 * hash: Object containing subject's distinguished name information
 * caKeyPath: the signer's key
 * caCertPath: the signer's certificate
 * cb: a callback of the form cb(err, keyBuf, certBuf)
 */
exports.generate_cert_buf = function (prefix, keepFiles, hash, caKeyPath, caCertPath, cb) {
  exports.generate_cert(prefix, keepFiles, hash, caKeyPath, caCertPath,
                        function (err, keyPath, certPath){
    if (err) return cb(err);
    fs.readFile(certPath, function (err, certBuf) {
      if (err) return cb(err);
      fs.readFile(keyPath, function (err, keyBuf) {
        cb(err, keyBuf, certBuf);
      });
    });
  });
}
