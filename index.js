#!/usr/bin/env node
const { exec, execSync } = require('child_process')
const inquirer = require('inquirer')
const chalk = require('chalk')
const ora = require('ora')
const consola = require('consola')
const { trim } = require('lodash')
const path = require('path')

const { name: projectName, version: currentVersion } = require('./package')

const regVersion = /^[1-9]{1}\d*\.\d+\.\d+$/

const regLineBreak = /\s/

const getGitBranch = execSync('git name-rev --name-only HEAD', {
  encoding: 'utf-8'
}).replace(regLineBreak, '')

const projectInfo = `(${chalk.yellowBright(getGitBranch)})`

const getNextDefaultVersion = () => {
  const numbers = currentVersion.split('.')
  const lastNumber = Number(numbers.pop())
  return numbers.concat(lastNumber + 1).join('.')
}

// if (!/release/.test(getGitBranch)) {
//   consola.warn(
//     '仅release分支用于版本更新,check-version脚本不会在其余分支运行，请勿手动修改package.json'
//   )
//   process.exit(0)
// }

console.log('\n')

inquirer
  .prompt([
    {
      type: 'confirm',
      name: 'needUpdateVersion',
      prefix: `${projectInfo}-`,
      suffix: `(当前版本号:${chalk.yellow(currentVersion)})`,
      message: `是否需要更新版本号?`,
      default: false
    },
    {
      type: 'input',
      name: 'version',
      default: getNextDefaultVersion(),
      prefix: `${projectInfo}-`,
      suffix: `(当前版本号:${chalk.yellow(currentVersion)})  : \n`,
      message: `请输入版本号:`,
      when(question) {
        return question.needUpdateVersion
      },
      validate(version) {
        if (!regVersion.test(version)) {
          console.log(
            chalk.yellow(
              '输入的版本号格式未通过检查,请检查格式(eg:1.0.0,1.1.0)'
            )
          )
          return false
        }
        return true
      }
    },
    {
      type: 'confirm',
      name: 'needAddTag',
      message: `${projectInfo}(${chalk.yellow(
        currentVersion
      )})-是否为当前版本添加Tag?`,
      default: false,
      when({ needUpdateVersion }) {
        return needUpdateVersion
      }
    },
    {
      type: 'list',
      name: 'operationType',
      message: '请选择本次更新的类型',
      choices: ['fix', 'feat', 'chore', 'build', 'doc'],
      when(question) {
        return question.needAddTag
      }
    },
    {
      type: 'input',
      name: 'versionDescr',
      message: '请输入版本描述*',
      when(question) {
        return question.needAddTag
      },
      validate(desc) {
        return !!trim(desc)
      }
    }
  ])
  .then(async (answers) => {
    const {
      version: newVersion,
      versionDescr,
      operationType,
      needAddTag
    } = answers
    if (!answers.needUpdateVersion) {
      process.exit(0)
    }
    if (newVersion && newVersion !== currentVersion) {
      let spinner
      try {
        await command(
          `yarn version --no-git-tag-version --new-version ${newVersion}`
        )
        console.log(
          chalk.green(
            `\n ${projectName} package.json版本号更新成功,当前版本为:${newVersion}`
          )
        )
        spinner = ora('git commit中...请等待git hooks执行..').start()
        await command(
          `git add package.json && git commit -m "chore(package.json): 更新项目版本号为：${newVersion}"`
        )
      } catch (err) {
        err
          ? spinner.fail('git执行失败，请手动提交package.json')
          : spinner.succeed('git commit成功，请直接push代码')
        console.log(chalk.red(err))
        console.log('\n')
        process.exit(1)
      }
      if (needAddTag) {
        try {
          spinner.start('正在对本次提交打tag,请耐心等待...')
          await command(
            `git tag -a v${newVersion} -m "${operationType}-${versionDescr}"`
          )
          spinner.start('正在push tag，请耐心等待...')
          await command(`git push origin --tags`)
        } catch (err) {
          console.log(err)
          consola.error('git Tag更新失败,请手动同步git tag')
          process.exit(1)
        }
      }
      spinner.stop()
      process.exit(0)
    } else {
      console.log(chalk.green(`本次未修改版本号,version:${newVersion} ! \n`))
    }
  })

function command(cmd, options = {}) {
  return new Promise((resolve, reject) => {
    exec(cmd, options, (err, stdout, stderr) => {
      if (err) {
        reject(err)
      } else {
        console.log(stdout)
        resolve(true)
      }
    })
  })
}
