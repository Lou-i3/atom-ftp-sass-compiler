'use babel';

import { CompositeDisposable } from 'atom';

export default {

  atomFtpSassCompilerView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      //'atom-ftp-sass-compiler:toggle': () => this.toggle(),
      'atom-ftp-sass-compiler:compile': () => this.compile(),
      'atom-ftp-sass-compiler:setup': () => this.setup(),
      'atom-ftp-sass-compiler:editSetup': () => this.editSetup()
    }));

    // Setting toggle for watcher to false
    this.watchState = false;
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  serialize() {

  },

  toggle() {
    if (this.watchState == true ) {
      this.watchState = false;
      // Stop watching save
      this.saveSubscription.dispose();
      atom.notifications.addInfo('Watch save for SASS compilation disabled.');

    } else if (this.watchState == false ){
      this.watchState = true;
      // Watch save
      this.saveSubscription = new CompositeDisposable();
      this.saveSubscription.add(atom.workspace.observeTextEditors(textEditor => {
          this.saveSubscription.add(textEditor.onDidSave(this.handleDidSave.bind(this)));
      }));
      this.saveSubscription.add(atom.commands.add('atom-workspace', 'atom-ftp-sass-compiler:compile', this.compile.bind(this)));

      atom.notifications.addSuccess('Watch save for SASS compilation enabled.',{detail:'The files will now be downloaded, compiled and uploaded on each save.'});
    }
  },

  setup() {
    const fs = require('fs');

    const pathConfig = __dirname + '/ftp-sass-compiler/config.txt';
    const pathConfig_example = __dirname + '/ftp-sass-compiler/config_example.txt';
    try {
      fs.accessSync(pathConfig, fs.F_OK);
      return true;
    } catch (error) {
      atom.notifications.addError('config.txt not found');
      // File destination.txt will be created or overwritten by default.
      fs.copyFile(pathConfig_example, pathConfig, (err) => {
        if (err) throw err;
        //console.log('source.txt was copied to destination.txt');
      });
      atom.notifications.addSuccess('config.txt file created');
      atom.workspace.open(pathConfig);
      atom.notifications.addInfo('Please complete with info and save');
      return false;
    }

  },

  editSetup() {
    const fs = require('fs');

    const pathConfig = __dirname + '/ftp-sass-compiler/config.txt';
    const pathConfig_example = __dirname + '/ftp-sass-compiler/config_example.txt';
    try {
      fs.accessSync(pathConfig, fs.F_OK);
    } catch (error) {
      atom.notifications.addError('config.txt not found');
      // File destination.txt will be created or overwritten by default.
      fs.copyFile(pathConfig_example, pathConfig, (err) => {
        if (err) throw err;
        //console.log('source.txt was copied to destination.txt');
      });
      atom.notifications.addSuccess('config.txt file created');

    } finally {
      atom.workspace.open(pathConfig);
    }
  },

  compile() {

    let setup = this.setup(); // Check setup first

    if (setup) {
      // Compile file to ftp
      this.pathToLib = __dirname + '/ftp-sass-compiler/lib/';
      this.pathToFiles = __dirname + '/ftp-sass-compiler';
      // Cleanup class
      const Cleanup = require(this.pathToLib + 'cleanup.js');
      let clean = new Cleanup(this.pathToFiles);

      // Convert class
      const Convert = require(this.pathToLib + 'convert.js');
      let sass = new Convert(this.pathToFiles);

      // Ftp class
      const Ftp = require(this.pathToLib + 'ftp.js');
      let ftp = new Ftp(this.pathToFiles);

      // Execution
      clean.deleteFiles();
      clean.createFiles();

      ftp.download().catch( (err) => {
        atom.notifications.addError('Error with the ftp connection.', {
          detail: 'Check your config.txt file by running editSetup command.'
        });
        throw err;
      }).then( () => {
        sass.sassEncoding('compressed')
      }).catch( (err) => {
        atom.notifications.addError('SASS compilation error.', {
          detail: err.message
        });
        throw err;
      }).then( () => {
        sass.sassEncoding('expanded')
      }).catch((err) => {
        atom.notifications.addError('SASS compilation error.', {
          detail: err.message
        });
        throw err;
      }).then( () => {
        ftp.upload()
      }).catch( (err) => {
        atom.notifications.addError('Error while uploading files.', {
          detail: err.message
        });
        throw err;
      }).then( () => {
        atom.notifications.addSuccess('Converted to CSS and uploaded');
      });
    }
  }

};
