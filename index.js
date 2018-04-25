const { exec } = require('child_process')
const esprima = require('esprima')
const fs = require('fs')
const path = require('path')
const process = require('process')

const excludeDirs = ['.', '..', 'node_modules', '.git']
const expectSuffix = ['.js']

const fDependencies = new Set()
const fDevDependencies = new Set()

function removeDependencies() {
    exec(`npm uninstall --save ${Array.from(fDependencies)}`, (error, stdout, stderr) => {
        console.log(stdout)
        console.log(stderr)
        if (error) {
            console.log(error)
            return
        }
        exec(`npm uninstall --save-dev ${Array.from(fDevDependencies)}`, (err, stdout, stderr) => {
            console.log(stdout)
            console.log(stderr)
            if (error) {
                console.log(error)
                console.log('Uninstall Fail')
                return
            }
            console.log('Uninstall Success')
        })
    })
}

function confirmRemove(isRemove = false) {
    const numDependencies = fDependencies.size
    const numDevDependencies = fDevDependencies.size
    if (numDependencies === 0 && numDevDependencies === 0) {
        console.log('No Unused Dependencies/DevDependencies')
    }
    if (numDependencies > 0) {
        console.log(`Unused Dependencies are: ${Array.from(fDependencies).toString()}`)
    }
    if (numDevDependencies > 0) {
        console.log(`Unused devDependencies are: ${Array.from(fDevDependencies).toString()}`)
    }
    if (!isRemove) {
        return
    }
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })
    rl.question('Do you want to remove these dependencies/devDependencies?(yes/no) ', (answer) => {
        rl.close()
        answer = answer.toLowerCase()
        if (answer === 'y' || answer === 'yes') {
            removeDependencies()
        }
    })
}

function checkDependencies(dependency) {
    if (fDependencies.has(dependency)) {
        fDependencies.delete(dependency)
    }
    if (fDevDependencies.has(dependency)) {
        fDevDependencies.delete(dependency)
    }
}

function parseVariableDeclaration(part) {
    if (!(part.declarations && part.declarations.length))
        return
    part.declarations.forEach(declaration => {
        if (declaration.type === 'VariableDeclarator'
            && declaration.init
            && declaration.init.type === 'CallExpression'
            && declaration.init.callee
            && declaration.init.callee.type === 'Identifier'
            && declaration.init.callee.name === 'require') {
                declaration.init.arguments.forEach(arg => {
                    const m = arg.value
                    checkDependencies(m)
                })
            }
    })
}

function parseImportDeclaration(part) {
    const m = part.source.value
    checkDependencies(m)
}

function readDir(dirname) {
    const files = fs.readdirSync(dirname)
    return files
}

function readFile(filename) {
    const stat = fs.statSync(filename)
    if (stat.isDirectory()) {
        const shouldInclude = excludeDirs.every(eDir => eDir !== filename)
        if (shouldInclude) {
            listDir(filename)
        }
        return
    }
    if (!stat.isFile()) {
        return
    }
    // if (filename === 'package.json') {
    //     /**
    //      * redundant parse
    //      * modify later
    //      */
    //     clean(process.cwd())
    //     return
    // }
    const shouldInclude = expectSuffix.some(suffix => filename.endsWith(suffix))
    if (!shouldInclude) {
        return
    }
    let fileContent = fs.readFileSync(filename, { encoding: 'utf8' })
    // handle hashbang/shebang
    fileContent = fileContent.replace(/(^#!.*)/, function(m) { return Array(m.length + 1).join(' ')})
    try {
        const body = esprima.parseModule(fileContent).body
        body.forEach(bodyPart => {
            switch (bodyPart.type) {
                case 'VariableDeclaration':
                    parseVariableDeclaration(bodyPart)
                    return
                case 'ImportDeclaration':
                    parseImportDeclaration(bodyPart)
                    return
                default:
                    return
            }
        })
    } catch (err) {
        return
    }
}

function listDir(dirname, isRoot = false) {
    const files = readDir(dirname)
    if (!isRoot) {
        process.chdir(dirname)
    }
    files.forEach(file => readFile(file))
    if (!isRoot) {
        process.chdir('..')
    }
}

function clean(rootdir = process.cwd(), isRemove = false) {
    const packageJson = path.join(rootdir, 'package.json')
    try {
        fs.accessSync(packageJson)
    } catch (err) {
        console.log('package.json doesnot exist')
        return
    }
    const fContent = fs.readFileSync(packageJson)
    const content = JSON.parse(fContent)
    if (content.dependencies) {
        Object.keys(content.dependencies).forEach(d => fDependencies.add(d))
    }
    if (content.devDependencies) {
        Object.keys(content.devDependencies).forEach(d => fDevDependencies.add(d))
    }
    listDir(rootdir, true)
    confirmRemove(isRemove)
}

exports.clean = clean
