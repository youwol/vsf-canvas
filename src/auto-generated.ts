
const runTimeDependencies = {
    "externals": {
        "@types/three": "^0.152.0",
        "@youwol/rx-tab-views": "^0.3.0",
        "@youwol/rx-vdom": "^1.0.1",
        "@youwol/vsf-core": "^0.3.2",
        "@youwol/webpm-client": "^3.0.7",
        "rxjs": "^7.5.6",
        "stats.js": "^0.17.0",
        "three": "^0.152.0"
    },
    "includedInBundle": {
        "d3-dag": "0.8.2"
    }
}
const externals = {
    "@types/three": {
        "commonjs": "@types/three",
        "commonjs2": "@types/three",
        "root": "@types/three_APIv0152"
    },
    "@youwol/rx-tab-views": {
        "commonjs": "@youwol/rx-tab-views",
        "commonjs2": "@youwol/rx-tab-views",
        "root": "@youwol/rx-tab-views_APIv03"
    },
    "@youwol/rx-vdom": {
        "commonjs": "@youwol/rx-vdom",
        "commonjs2": "@youwol/rx-vdom",
        "root": "@youwol/rx-vdom_APIv1"
    },
    "@youwol/vsf-core": {
        "commonjs": "@youwol/vsf-core",
        "commonjs2": "@youwol/vsf-core",
        "root": "@youwol/vsf-core_APIv03"
    },
    "@youwol/webpm-client": {
        "commonjs": "@youwol/webpm-client",
        "commonjs2": "@youwol/webpm-client",
        "root": "@youwol/webpm-client_APIv3"
    },
    "rxjs": {
        "commonjs": "rxjs",
        "commonjs2": "rxjs",
        "root": "rxjs_APIv7"
    },
    "rxjs/operators": {
        "commonjs": "rxjs/operators",
        "commonjs2": "rxjs/operators",
        "root": [
            "rxjs_APIv7",
            "operators"
        ]
    },
    "stats.js": {
        "commonjs": "stats.js",
        "commonjs2": "stats.js",
        "root": "stats.js_APIv017"
    },
    "three": {
        "commonjs": "three",
        "commonjs2": "three",
        "root": "three_APIv0152"
    }
}
const exportedSymbols = {
    "@types/three": {
        "apiKey": "0152",
        "exportedSymbol": "@types/three"
    },
    "@youwol/rx-tab-views": {
        "apiKey": "03",
        "exportedSymbol": "@youwol/rx-tab-views"
    },
    "@youwol/rx-vdom": {
        "apiKey": "1",
        "exportedSymbol": "@youwol/rx-vdom"
    },
    "@youwol/vsf-core": {
        "apiKey": "03",
        "exportedSymbol": "@youwol/vsf-core"
    },
    "@youwol/webpm-client": {
        "apiKey": "3",
        "exportedSymbol": "@youwol/webpm-client"
    },
    "rxjs": {
        "apiKey": "7",
        "exportedSymbol": "rxjs"
    },
    "stats.js": {
        "apiKey": "017",
        "exportedSymbol": "stats.js"
    },
    "three": {
        "apiKey": "0152",
        "exportedSymbol": "three"
    }
}

const mainEntry : {entryFile: string,loadDependencies:string[]} = {
    "entryFile": "./index.ts",
    "loadDependencies": [
        "@youwol/webpm-client",
        "@youwol/rx-vdom",
        "@youwol/vsf-core",
        "rxjs",
        "three"
    ]
}

const secondaryEntries : {[k:string]:{entryFile: string, name: string, loadDependencies:string[]}}= {}

const entries = {
     '@youwol/vsf-canvas': './index.ts',
    ...Object.values(secondaryEntries).reduce( (acc,e) => ({...acc, [`@youwol/vsf-canvas/${e.name}`]:e.entryFile}), {})
}
export const setup = {
    name:'@youwol/vsf-canvas',
        assetId:'QHlvdXdvbC92c2YtY2FudmFz',
    version:'0.3.1-wip',
    shortDescription:"3D rendering of vs-flow's workflow.",
    developerDocumentation:'https://platform.youwol.com/applications/@youwol/cdn-explorer/latest?package=@youwol/vsf-canvas&tab=doc',
    npmPackage:'https://www.npmjs.com/package/@youwol/vsf-canvas',
    sourceGithub:'https://github.com/youwol/vsf-canvas',
    userGuide:'https://l.youwol.com/doc/@youwol/vsf-canvas',
    apiVersion:'03',
    runTimeDependencies,
    externals,
    exportedSymbols,
    entries,
    secondaryEntries,
    getDependencySymbolExported: (module:string) => {
        return `${exportedSymbols[module].exportedSymbol}_APIv${exportedSymbols[module].apiKey}`
    },

    installMainModule: ({cdnClient, installParameters}:{
        cdnClient:{install:(unknown) => Promise<WindowOrWorkerGlobalScope>},
        installParameters?
    }) => {
        const parameters = installParameters || {}
        const scripts = parameters.scripts || []
        const modules = [
            ...(parameters.modules || []),
            ...mainEntry.loadDependencies.map( d => `${d}#${runTimeDependencies.externals[d]}`)
        ]
        return cdnClient.install({
            ...parameters,
            modules,
            scripts,
        }).then(() => {
            return window[`@youwol/vsf-canvas_APIv03`]
        })
    },
    installAuxiliaryModule: ({name, cdnClient, installParameters}:{
        name: string,
        cdnClient:{install:(unknown) => Promise<WindowOrWorkerGlobalScope>},
        installParameters?
    }) => {
        const entry = secondaryEntries[name]
        if(!entry){
            throw Error(`Can not find the secondary entry '${name}'. Referenced in template.py?`)
        }
        const parameters = installParameters || {}
        const scripts = [
            ...(parameters.scripts || []),
            `@youwol/vsf-canvas#0.3.1-wip~dist/@youwol/vsf-canvas/${entry.name}.js`
        ]
        const modules = [
            ...(parameters.modules || []),
            ...entry.loadDependencies.map( d => `${d}#${runTimeDependencies.externals[d]}`)
        ]
        return cdnClient.install({
            ...parameters,
            modules,
            scripts,
        }).then(() => {
            return window[`@youwol/vsf-canvas/${entry.name}_APIv03`]
        })
    },
    getCdnDependencies(name?: string){
        if(name && !secondaryEntries[name]){
            throw Error(`Can not find the secondary entry '${name}'. Referenced in template.py?`)
        }
        const deps = name ? secondaryEntries[name].loadDependencies : mainEntry.loadDependencies

        return deps.map( d => `${d}#${runTimeDependencies.externals[d]}`)
    }
}
