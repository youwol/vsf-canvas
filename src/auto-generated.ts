
const runTimeDependencies = {
    "externals": {
        "@youwol/cdn-client": "^2.0.6",
        "@youwol/flux-view": "^1.1.1",
        "@youwol/vsf-core": "^0.2.1",
        "rxjs": "^6.5.5",
        "three": "^0.152.0",
        "@youwol/fv-tabs": "^0.2.1",
        "stats.js": "^0.17.0",
        "@types/three": "^0.152.0"
    },
    "includedInBundle": {
        "d3-dag": "0.8.2"
    }
}
const externals = {
    "@youwol/cdn-client": {
        "commonjs": "@youwol/cdn-client",
        "commonjs2": "@youwol/cdn-client",
        "root": "@youwol/cdn-client_APIv2"
    },
    "@youwol/flux-view": {
        "commonjs": "@youwol/flux-view",
        "commonjs2": "@youwol/flux-view",
        "root": "@youwol/flux-view_APIv1"
    },
    "@youwol/vsf-core": {
        "commonjs": "@youwol/vsf-core",
        "commonjs2": "@youwol/vsf-core",
        "root": "@youwol/vsf-core_APIv02"
    },
    "rxjs": {
        "commonjs": "rxjs",
        "commonjs2": "rxjs",
        "root": "rxjs_APIv6"
    },
    "three": {
        "commonjs": "three",
        "commonjs2": "three",
        "root": "THREE_APIv0152"
    },
    "@youwol/fv-tabs": {
        "commonjs": "@youwol/fv-tabs",
        "commonjs2": "@youwol/fv-tabs",
        "root": "@youwol/fv-tabs_APIv02"
    },
    "stats.js": {
        "commonjs": "stats.js",
        "commonjs2": "stats.js",
        "root": "stats.js_APIv017"
    },
    "@types/three": {
        "commonjs": "@types/three",
        "commonjs2": "@types/three",
        "root": "@types/three_APIv0152"
    },
    "rxjs/operators": {
        "commonjs": "rxjs/operators",
        "commonjs2": "rxjs/operators",
        "root": [
            "rxjs_APIv6",
            "operators"
        ]
    }
}
const exportedSymbols = {
    "@youwol/cdn-client": {
        "apiKey": "2",
        "exportedSymbol": "@youwol/cdn-client"
    },
    "@youwol/flux-view": {
        "apiKey": "1",
        "exportedSymbol": "@youwol/flux-view"
    },
    "@youwol/vsf-core": {
        "apiKey": "02",
        "exportedSymbol": "@youwol/vsf-core"
    },
    "rxjs": {
        "apiKey": "6",
        "exportedSymbol": "rxjs"
    },
    "three": {
        "apiKey": "0152",
        "exportedSymbol": "THREE"
    },
    "@youwol/fv-tabs": {
        "apiKey": "02",
        "exportedSymbol": "@youwol/fv-tabs"
    },
    "stats.js": {
        "apiKey": "017",
        "exportedSymbol": "stats.js"
    },
    "@types/three": {
        "apiKey": "0152",
        "exportedSymbol": "@types/three"
    }
}

const mainEntry : {entryFile: string,loadDependencies:string[]} = {
    "entryFile": "./index.ts",
    "loadDependencies": [
        "@youwol/cdn-client",
        "@youwol/flux-view",
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
    version:'0.2.1',
    shortDescription:"3D rendering of vs-flow's workflow.",
    developerDocumentation:'https://platform.youwol.com/applications/@youwol/cdn-explorer/latest?package=@youwol/vsf-canvas&tab=doc',
    npmPackage:'https://www.npmjs.com/package/@youwol/vsf-canvas',
    sourceGithub:'https://github.com/youwol/vsf-canvas',
    userGuide:'https://l.youwol.com/doc/@youwol/vsf-canvas',
    apiVersion:'02',
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
            return window[`@youwol/vsf-canvas_APIv02`]
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
            `@youwol/vsf-canvas#0.2.1~dist/@youwol/vsf-canvas/${entry.name}.js`
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
            return window[`@youwol/vsf-canvas/${entry.name}_APIv02`]
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
