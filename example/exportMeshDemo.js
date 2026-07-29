/**
 * UnityJs 3D Mesh & SkinnedMeshRenderer Exporter Demo
 *
 * This example demonstrates how to configure THREE and GLTFExporter dependency injection
 * and extract 3D Mesh assets (as OBJ format) and SkinnedMeshRenderer assets (as GLTF/GLB format).
 *
 * Usage (Node.js):
 *   node exportMeshDemo.js <path_to_unity_assetbundles_folder_or_file>
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { UnityJs } from '../UnityJs/unityJs.js'

// Import THREE and GLTFExporter for dependency injection in Node.js
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

// Inject the 3D dependencies into UnityJs
UnityJs.setDependencies({ THREE, GLTFExporter })

// Resolve current directory for ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runDemo() {
    const inputPath = process.argv[2]

    if (!inputPath || !fs.existsSync(inputPath)) {
        console.error(`\nError: Please provide a valid path to a bundle file or directory containing bundles.`)
        console.log(`Provided path: ${inputPath || '(none)'}`)
        console.log('\nUsage:')
        console.log('  node exportMeshDemo.js <path_to_unity_bundle_file_or_directory>')
        return
    }

    console.log(`[Demo] Scanning for Unity bundles in: ${inputPath}`)

    // Resolve all files in input path
    let bundleFiles = []
    if (fs.statSync(inputPath).isDirectory()) {
        bundleFiles = fs
            .readdirSync(inputPath)
            .filter((f) => f.endsWith('.bundle') || f.endsWith('.assets') || !path.extname(f))
            .map((f) => path.join(inputPath, f))
    } else {
        bundleFiles = [inputPath]
    }

    if (bundleFiles.length === 0) {
        console.log('[Demo] No bundle files found to process.')
        return
    }

    // 1. Load bundles into UnityJs Active Managers
    const managers = []
    console.log(`[Demo] Loading ${bundleFiles.length} files...`)
    for (const filePath of bundleFiles) {
        try {
            const fileData = fs.readFileSync(filePath)
            const manager = await UnityJs.load(fileData.buffer)
            if (manager) {
                managers.push(manager)
                console.log(`  Loaded: ${path.basename(filePath)}`)
            }
        } catch (e) {
            console.warn(`  Failed to load ${path.basename(filePath)}:`, e.message)
        }
    }

    // 2. Scan and extract Mesh & SkinnedMeshRenderer assets
    const outputDir = path.resolve(__dirname, './output/Meshes')
    console.log(`\n[Demo] Output directory: ${outputDir}`)
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
    }

    let meshCount = 0
    let skinnedMeshCount = 0

    for (const manager of managers) {
        const objectInfos = manager.getObjectInfos()

        // Register companion resource files if any
        for (const assetFile of manager.assetFiles) {
            const assetsPath = assetFile.name
            if (assetsPath && assetsPath.toLowerCase().endsWith('.assets')) {
                const companionResS = assetsPath + '.resS'
                const companionResource = assetsPath + '.resource'
                ;[companionResS, companionResource].forEach((cand) => {
                    const fullCandPath = path.join(path.dirname(inputPath), path.basename(cand))
                    if (fs.existsSync(fullCandPath)) {
                        const companionData = fs.readFileSync(fullCandPath)
                        manager.registerResourceFile(path.basename(cand), new Uint8Array(companionData.buffer))
                        console.log(`  Registered companion resource file: ${path.basename(cand)}`)
                    }
                })
            }
        }

        for (const info of objectInfos) {
            const className = info.getClassName()

            if (className === 'Mesh') {
                try {
                    console.log(`  Processing Mesh: "${info.name || '<unnamed>'}"...`)
                    // Export as OBJ text format
                    const fileInfo = await manager.exportFile(info, { type: 'text' })
                    if (fileInfo && fileInfo.data && fileInfo.data.raw) {
                        const targetPath = path.join(outputDir, `${info.name || 'mesh_' + info.pathID}.obj`)
                        fs.mkdirSync(path.dirname(targetPath), { recursive: true })
                        fs.writeFileSync(targetPath, fileInfo.data.raw)
                        console.log(`    √ Saved Mesh to: ${path.basename(targetPath)}`)
                        meshCount++
                    }
                } catch (e) {
                    console.error(`    ❌ Failed to export Mesh "${info.name}":`, e.message)
                }
            } else if (className === 'SkinnedMeshRenderer') {
                try {
                    console.log(`  Processing SkinnedMeshRenderer: "${info.name || '<unnamed>'}"...`)
                    // Export as GLB binary format
                    const fileInfo = await manager.exportFile(info, { type: 'arrayBuffer' })
                    if (fileInfo && fileInfo.data && fileInfo.data.raw) {
                        const targetPath = path.join(outputDir, `${info.name || 'skinned_mesh_' + info.pathID}.glb`)
                        fs.mkdirSync(path.dirname(targetPath), { recursive: true })
                        fs.writeFileSync(targetPath, Buffer.from(fileInfo.data.raw))
                        console.log(`    √ Saved SkinnedMeshRenderer to: ${path.basename(targetPath)}`)
                        skinnedMeshCount++
                    }
                } catch (e) {
                    console.error(`    ❌ Failed to export SkinnedMeshRenderer "${info.name}":`, e.message)
                }
            }
        }
    }

    console.log(
        `\n[Demo] Export completed successfully! Total Mesh: ${meshCount}, SkinnedMeshRenderer: ${skinnedMeshCount}`,
    )
}

runDemo().catch((err) => {
    console.error('[Demo] Error running mesh export demo:', err)
})
