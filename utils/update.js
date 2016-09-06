const chalk = require('chalk');
const moment = require('moment');
const prompt = require('prompt');
const spawn = require('cross-spawn');

let gitStatus = spawn.sync('git', ['status'], {
    verbose: true
});

console.info(gitStatus.stdout.toString());

prompt.message = chalk.cyan('Is this okay?');
prompt.delimiter = ' ';
prompt.start();

prompt.get({
    properties: {
        shouldContinue: {
            description: '(Y/n)'
        }
    }
}, (err, result) => {
    if (result.shouldContinue && result.shouldContinue.trim() === 'Y') {
        console.info(chalk.green('Committing changes...'));
        let date = moment().format('MM/DD/YYYY, hh:mm:ss');
        spawn.sync('git', ['add', '--all']);
        spawn.sync('git', ['commit', '-m', '[Auto Generated] Update - ' + date]);
        console.info(chalk.green('Pushing changes...'));
        let gitPush = spawn.sync('git', ['push', 'origin', 'master']);
        console.info(gitPush.stdout.toString());
        console.info(gitPush.stderr.toString());
    }
});

