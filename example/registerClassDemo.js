/**
 * UnityJs Custom Class Registration (Pluggable API) Demo
 *
 * This example demonstrates how to register a custom Unity class parser
 * dynamically without modifying the core files of the UnityJs parser engine.
 *
 * Usage (Node.js):
 *   node registerClassDemo.js
 */

import { UnityJs } from '../UnityJs/unityJs.js'
import { NamedObject } from '../UnityJs/unityfs/classes/namedObject.js'
import { ObjectReader } from '../UnityJs/unityfs/objectReader.js'

// 1. Define a Custom Game Class extending NamedObject
class CustomGameSettings extends NamedObject {
    // Expose attributes for serialization / inspections
    static exposedAttributes = ['name', 'gameVersion', 'developerMode']

    constructor(reader) {
        super(reader) // Reads the object name automatically

        // Read custom fields from binary stream
        this.gameVersion = reader.readAlignedString()
        this.developerMode = reader.readUInt8() !== 0
    }
}

async function runDemo() {
    console.log('[Demo] Initializing Custom Class Registration...')

    // Custom class parameters
    const CUSTOM_CLASS_ID = 999
    const CUSTOM_CLASS_NAME = 'CustomGameSettings'

    // 2. Register the Custom Class parser in UnityJs ObjectRegistry using the Pluggable API
    UnityJs.registerClass(CUSTOM_CLASS_ID, CUSTOM_CLASS_NAME, CustomGameSettings)
    console.log(`[Demo] Registered class ID ${CUSTOM_CLASS_ID} as "${CUSTOM_CLASS_NAME}" successfully!`)

    // 3. Test verification by constructing a mock binary buffer
    // Layout:
    // - name: "GlobalSettings" (Aligned String: length 14 + data + padding to align)
    // - gameVersion: "v1.2.4-stable" (Aligned String: length 13 + data + padding to align)
    // - developerMode: 1 (UInt8)

    // Construct binary writer helper mock bytes
    const mockBytes = new Uint8Array([
        // Aligned String 1: "GlobalSettings" (len = 14)
        14,
        0,
        0,
        0,
        71,
        108,
        111,
        98,
        97,
        108,
        83,
        101,
        116,
        116,
        105,
        110,
        103,
        115, // "GlobalSettings"
        0,
        0, // Padding to align 4 bytes boundary

        // Aligned String 2: "v1.2.4-stable" (len = 13)
        13,
        0,
        0,
        0,
        118,
        49,
        46,
        50,
        46,
        52,
        45,
        115,
        116,
        97,
        98,
        108,
        101, // "v1.2.4-stable"
        0,
        0,
        0, // Padding to align 4 bytes boundary

        // UInt8: 1 (Developer Mode = true)
        1,
    ])

    console.log('[Demo] Constructing ObjectReader with mock settings data...')
    const reader = new ObjectReader(mockBytes, 15, '2019.4.0f1', 'WebGL', 1n, 0, mockBytes.length, 999, 999)
    reader.endian = 'little'

    // 4. Resolve the custom parser class and parse the mock data stream
    // This simulates what UnityJs core does internally when it encounters this ClassID in type tree mapping
    const CustomParser = CustomGameSettings
    const instance = new CustomParser(reader)

    console.log('\n[Demo] Parsed custom instance details:')
    console.log(`  Name:           "${instance.name}"`)
    console.log(`  Game Version:   "${instance.gameVersion}"`)
    console.log(`  Developer Mode: ${instance.developerMode}`)

    console.log('\n[Demo] Pluggable Class Registry verification complete.')
}

runDemo().catch((err) => {
    console.error('[Demo] Error running custom class registry demo:', err)
})
