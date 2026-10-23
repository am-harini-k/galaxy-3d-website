import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

/**
 * =========================
 * GALAXY CONTROL PANEL
 * (attractive bottom drawer, replaces the old lil-gui sidebar)
 * =========================
 */

let galaxyPanel = null
let isPanelVisible = false

/**
 * =========================
 * CANVAS
 * =========================
 */

const canvas =
    document.querySelector('canvas.webgl')

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const fontLoader = new FontLoader()
const textGroup = new THREE.Group()
const clickableObjects = []
const openingClock = new THREE.Clock()

let centerHitArea = null
let instructionGroup = null
let ringPulseGroup = null
let instructionActive = true
let openingStarted = false
let galaxyOpeningStart = 0
let textAnimationStart = 0
let interactText = null
let portfolioText = null
let loadedFont = null

let interactMobileTop = null
let interactMobileBottom = null
let portfolioMobile = null

let cameraCorrectionStarted = false
let cameraCorrectionStart = 0

const cameraCorrectionFromPosition = new THREE.Vector3()
const cameraCorrectionFromTarget = new THREE.Vector3()

const cameraCorrectionToPosition = new THREE.Vector3(0, 3, 8)
const cameraCorrectionToTarget = new THREE.Vector3(0, 0, 0)


//let solarSystemGroup = null
//let travelStarted = false
//let travelStart = 0
//const travelDuration = 3.2

const easeOutCubic = (value) =>
{
    return 1 - Math.pow(1 - value, 3)
}

const toggleGalaxyGUI = () =>
{
    isPanelVisible = !isPanelVisible

    if(galaxyPanel)
    {
        galaxyPanel.classList.toggle('galaxy-panel--open', isPanelVisible)
    }
}

let portfolioTravelStarted = false
let portfolioTravelStart = 0



const beginPortfolioTravel = () =>
{
    if(portfolioTravelStarted)
    {
        return
    }

    portfolioTravelStarted = true
    portfolioTravelStart = openingClock.getElapsedTime()

    instructionActive = false
    controls.enabled = false

    if(instructionGroup)
    {
        instructionGroup.visible = false
    }
}




const createInstruction = () =>
{
    const instructionCanvas = document.createElement('canvas')
    instructionCanvas.width = 1000
    instructionCanvas.height = 220

    const context = instructionCanvas.getContext('2d')
    context.clearRect(0, 0, instructionCanvas.width, instructionCanvas.height)
    context.font = '600 70px Georgia, serif'
    context.textAlign = 'center'
    context.fillStyle = '#fff0c2'
    //context.shadowColor = '#3b82f6'
    context.textBaseline = 'middle'
    //context.shadowBlur = 1
    context.fillText('Touch the galaxy center', 500, 100)

    const texture = new THREE.CanvasTexture(instructionCanvas)
    const label = new THREE.Sprite(
        new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            blending: THREE.NormalBlending
        })
    )
    label.scale.set(4.2, 1.20, 1)
    label.position.set(0, 3.6, 0)

    // Pulsing double ring around the galaxy center — reads as
    // "tap here" without needing a literal arrow pointing at it.
    

    instructionGroup = new THREE.Group()
    instructionGroup.add(label)
    scene.add(instructionGroup)
}

const createGradientText = (text, position, onClick) =>
{
    const geometry = new TextGeometry(text, {
        font: loadedFont,
        size: 0.42,
        depth: 0.06,
        curveSegments: 12,
        bevelEnabled: true,
        bevelThickness: 0.012,
        bevelSize: 0.008,
        bevelSegments: 3
    })
    geometry.computeBoundingBox()
    geometry.center()

    const colorInside = new THREE.Color('#fff0c2')
    const colorOutside = new THREE.Color('#3b82f6')
    const positions = geometry.getAttribute('position')
    const colors = new Float32Array(positions.count * 3)
    const bounds = geometry.boundingBox
    const width = Math.max(bounds.max.x - bounds.min.x, 0.001)

    for(let i = 0; i < positions.count; i++)
    {
        const ratio = (positions.getX(i) - bounds.min.x) / width
        const color = colorInside.clone().lerp(colorOutside, ratio)
        colors[i * 3] = color.r
        colors[i * 3 + 1] = color.g
        colors[i * 3 + 2] = color.b
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    })
    const textMesh = new THREE.Mesh(geometry, material)
    textMesh.position.set(0, 0, 0)
    textMesh.scale.setScalar(0.001)
    textMesh.userData.finalPosition = position.clone()
    textMesh.userData.onClick = onClick

    // Store the real width of this 3D text.
// This will be used to decide whether
// the desktop layout can fit on screen.
textMesh.userData.textWidth = width

    textGroup.add(textMesh)
    clickableObjects.push(textMesh)
    return textMesh
}

const createCenterInteraction = () =>
{
    centerHitArea = new THREE.Mesh(
        new THREE.SphereGeometry(1.5, 24, 16),
        new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false
        })
    )
    scene.add(centerHitArea)
}

const loadGalaxyText = () =>
{
    fontLoader.load(
        'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
        (font) =>
        {
            loadedFont = font

            // =========================
            // DESKTOP LAYOUT
            // =========================

            interactText = createGradientText(
                'Interact with Galaxy',
                new THREE.Vector3(-3, 3, 2),
                toggleGalaxyGUI
            )

            portfolioText = createGradientText(
                "Harini's Portfolio",
                new THREE.Vector3(3, 3, 2),
                beginPortfolioTravel
            )


            // =========================
            // MOBILE LAYOUT
            // =========================

            interactMobileTop = createGradientText(
                'Interact',
                new THREE.Vector3(0, 3.5, 2),
                toggleGalaxyGUI
            )

            interactMobileBottom = createGradientText(
                'with Galaxy',
                new THREE.Vector3(0, 3.0, 2),
                toggleGalaxyGUI
            )

            portfolioMobile = createGradientText(
                "Harini's Portfolio",
                new THREE.Vector3(0, -2.8, 2),
                beginPortfolioTravel
            )


            // Hide mobile versions initially
            interactMobileTop.visible = false
            interactMobileBottom.visible = false
            portfolioMobile.visible = false


            scene.add(textGroup)

            // Decide which layout fits the screen
            updateTextLayout()
        }
    )
}

const openGalaxy = () =>
{
    if(openingStarted)
    {
        return
    }

    openingStarted = true
    instructionActive = false

    galaxyOpeningStart = openingClock.getElapsedTime()
    textAnimationStart = galaxyOpeningStart

    // Remember the camera's current position
    // before correcting it.
    cameraCorrectionFromPosition.copy(camera.position)
    cameraCorrectionFromTarget.copy(controls.target)

    // Start one-time camera correction
    cameraCorrectionStarted = true
    cameraCorrectionStart = openingClock.getElapsedTime()

    // Temporarily stop OrbitControls
    // while the camera is being corrected.
    controls.enabled = false

    if(instructionGroup)
    {
        scene.remove(instructionGroup)
    }
}

const updatePointer = (event) =>
{
    const bounds = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
}

const handlePointer = (event) =>
{
    updatePointer(event)
    raycaster.setFromCamera(pointer, camera)


    // Only allow currently visible text objects
    // to receive clicks.
    const visibleClickableObjects =
        clickableObjects.filter(
            (textMesh) =>
                textMesh.visible &&
                textMesh.scale.x > 0.05
        )


    const textHit =
        raycaster.intersectObjects(
            visibleClickableObjects,
            false
        )[0]


    if(textHit)
    {
        textHit.object.userData.onClick()
        return
    }


    // If the galaxy has not been opened yet,
    // clicking its center starts the opening.
    if(
        !openingStarted &&
        centerHitArea &&
        raycaster.intersectObject(centerHitArea).length
    )
    {
        openGalaxy()
    }
}
canvas.addEventListener(
    'pointerdown',
    handlePointer
)

/**
 * =========================
 * SCENE
 * =========================
 */

const scene = new THREE.Scene()



/**
 * =========================
 * TEXTURE
 * =========================
 */

const textureLoader =
    new THREE.TextureLoader()

const particlesTexture =
    textureLoader.load('/particles/5.png')


/**
 * =========================
 * PARAMETERS
 * =========================
 */

const parameters = {}
parameters.backgroundColor = '#000005'
/**
 * Number of particles
 */
parameters.count = 100000


/**
 * Particle size
 */
parameters.size = 0.015


/**
 * Galaxy size
 */
parameters.radius = 5


/**
 * Number of spiral arms
 */
parameters.branches = 5


/**
 * Spiral curve
 */
parameters.spin = 1


/**
 * Natural variation
 */
parameters.randomness = 0.4


/**
 * Randomness distribution
 */
parameters.randomnessPower = 2


/**
 * Galaxy colors
 */
parameters.insideColor = '#fffaff'
parameters.outsideColor = '#a78bfa'


/**
 * =========================
 * GALAXY VARIABLES
 * =========================
 */
scene.background =
    new THREE.Color(
        parameters.backgroundColor
    )


let geometry = null

let material = null

let points = null


/**
 * Background Stars
 */
const generateBackgroundStars = () =>
{
    const starsGeometry =
        new THREE.BufferGeometry()

    const starsCount = 8000

    const positions =
        new Float32Array(
            starsCount * 3
        )

    for(let i = 0; i < starsCount; i++)
    {
        const i3 = i * 3

        // Random stars across space
        positions[i3] =
            (Math.random() - 0.5) * 80

        positions[i3 + 1] =
            (Math.random() - 0.5) * 50

        positions[i3 + 2] =
            (Math.random() - 0.5) * 60
    }

    starsGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(
            positions,
            3
        )
    )


    const starsMaterial =
        new THREE.PointsMaterial({

            size: 0.025,

            sizeAttenuation: true,

            transparent: true,

            alphaMap: particlesTexture,

            depthWrite: false,

            color: '#ffffff'
        })


    const stars =
        new THREE.Points(
            starsGeometry,
            starsMaterial
        )


    scene.add(stars)
}






/**
 * =========================
 * GENERATE GALAXY
 * =========================
 */
const generateGalaxy = () =>
{
    /**
     * Remove old galaxy
     */

    if(points !== null)
    {
        geometry.dispose()

        material.dispose()

        scene.remove(points)
    }


    /**
     * Geometry
     */

    geometry =
        new THREE.BufferGeometry()


    const positions =
        new Float32Array(
            parameters.count * 3
        )


    const colors =
        new Float32Array(
            parameters.count * 3
        )


    /**
     * Colors
     */

    const colorInside =
        new THREE.Color(
            parameters.insideColor
        )


    const colorOutside =
        new THREE.Color(
            parameters.outsideColor
        )


    /**
     * Create particles
     */

    for(
        let i = 0;
        i < parameters.count;
        i++
    )
    {
        const i3 =
            i * 3


        /**
         * =========================
         * RADIUS
         * =========================
         *
         * More particles near
         * the galaxy center
         */

        const radius =
            Math.pow(
                Math.random(),
                1.4
            )
            *
            parameters.radius


        /**
         * =========================
         * BRANCH
         * =========================
         */

        const branchAngle =
            (i % parameters.branches)
            /
            parameters.branches
            *
            Math.PI
            *
            2


        /**
         * =========================
         * SPIRAL
         * =========================
         */

        const spinAngle =
            radius
            *
            parameters.spin


        /**
         * =========================
         * RANDOMNESS
         * =========================
         */

        const randomX =
            Math.pow(
                Math.random(),
                parameters.randomnessPower
            )
            *
            (
                Math.random() < 0.5
                ?
                1
                :
                -1
            )
            *
            parameters.randomness
            *
            radius


        /**
         * Make galaxy thinner
         * vertically
         */

        const randomY =
            Math.pow(
                Math.random(),
                parameters.randomnessPower
            )
            *
            (
                Math.random() < 0.5
                ?
                1
                :
                -1
            )
            *
            parameters.randomness
            *
            radius
            *
            0.35


        const randomZ =
            Math.pow(
                Math.random(),
                parameters.randomnessPower
            )
            *
            (
                Math.random() < 0.5
                ?
                1
                :
                -1
            )
            *
            parameters.randomness
            *
            radius


        /**
         * =========================
         * COLOR
         * =========================
         */

        const mixedColor = new THREE.Color()

const pinkColor = new THREE.Color('#e879f9')

const ratio = radius / parameters.radius

if (ratio < 0.5)
{
    mixedColor.copy(colorInside)

    mixedColor.lerp(
        pinkColor,
        ratio * 2
    )
}
else
{
    mixedColor.copy(pinkColor)

    mixedColor.lerp(
        colorOutside,
        (ratio - 0.5) * 2
    )
}


        colors[i3] =
            mixedColor.r

        colors[i3 + 1] =
            mixedColor.g

        colors[i3 + 2] =
            mixedColor.b


        /**
         * =========================
         * POSITION
         * =========================
         */

        positions[i3] =

            Math.cos(
                branchAngle
                +
                spinAngle
            )
            *
            radius
            +
            randomX


        positions[i3 + 1] =
            randomY


        positions[i3 + 2] =

            Math.sin(
                branchAngle
                +
                spinAngle
            )
            *
            radius
            +
            randomZ
    }


    /**
     * =========================
     * SET GEOMETRY
     * =========================
     */

    geometry.setAttribute(

        'position',

        new THREE.BufferAttribute(
            positions,
            3
        )
    )


    geometry.setAttribute(

        'color',

        new THREE.BufferAttribute(
            colors,
            3
        )
    )


    /**
     * =========================
     * MATERIAL
     * =========================
     */

    material =
        new THREE.PointsMaterial({

            size:
                parameters.size,


            sizeAttenuation:
                true,


            transparent:
                true,


            alphaMap:
                particlesTexture,


            depthWrite:
                false,


            vertexColors:
                true,


            /**
             * Makes overlapping
             * particles glow
             */

            blending:
                THREE.AdditiveBlending
        })


    /**
     * =========================
     * POINTS
     * =========================
     */

    points =
        new THREE.Points(
            geometry,
            material
        )


    scene.add(points)
}


/**
 * Generate galaxy
 */
generateBackgroundStars()
generateGalaxy()
createInstruction()
createCenterInteraction()
loadGalaxyText()



/**
 * =========================
 * CUSTOM GALAXY CONTROL PANEL
 * =========================
 *
 * A styled drawer that slides up
 * from the bottom of the page,
 * instead of a plain sidebar GUI.
 */

const createGalaxyControlPanel = () =>
{
    const style = document.createElement('style')

    style.textContent = `

        .galaxy-panel {
            position: fixed;
            left: 50%;
            bottom: 0;
            z-index: 40;
            width: min(960px, 94vw);
            max-height: 72vh;
            overflow-y: auto;
            transform: translate(-50%, 100%);
            padding: 10px 24px 16px;
            border-radius: 26px 26px 0 0;
            background: linear-gradient(165deg, rgba(14,16,32,.92), rgba(4,5,13,.96));
            border: 1px solid rgba(255, 240, 194, .16);
            border-bottom: none;
            box-shadow: 0 -30px 70px rgba(0,0,0,.55), 0 -1px 40px rgba(59,130,246,.12) inset;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            font-family: Georgia, serif;
            color: #fff0c2;
            transition: transform .6s cubic-bezier(.16, 1, .3, .98);
            touch-action: pan-y;
        }

        .galaxy-panel--open {
            transform: translate(-50%, 0);
        }

        .galaxy-panel-handle {
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            height: 22px;
            margin-bottom: 6px;
            cursor: pointer;
        }

        .galaxy-panel-grip {
            width: 46px;
            height: 5px;
            border-radius: 3px;
            background: linear-gradient(90deg, #fff0c2, #3b82f6);
            opacity: .55;
        }

        .galaxy-panel-close {
            position: absolute;
            right: 0;
            top: -6px;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            border: 1px solid rgba(255,240,194,.3);
            background: rgba(255,255,255,.04);
            color: #fff0c2;
            font-size: 20px;
            line-height: 1;
            cursor: pointer;
            transition: background .25s ease, transform .25s ease;
        }

        .galaxy-panel-close:hover {
            background: rgba(59,130,246,.25);
            transform: rotate(90deg);
        }

        .galaxy-panel-header {
            text-align: center;
            margin-bottom: 8px;
        }

        .galaxy-panel-header h3 {
            margin: 0 0 4px;
            font-size: 22px;
            letter-spacing: .1em;
            text-transform: uppercase;
            background: linear-gradient(90deg, #fff0c2, #3b82f6);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
        }

        .galaxy-panel-header p {
            margin: 0;
            font-size: 12.5px;
            letter-spacing: .06em;
            opacity: .6;
        }

        .galaxy-panel-sliders {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
            gap: 8px 22px;
            margin-bottom: 10px;
        }

        .galaxy-control {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .galaxy-control-label {
            display: flex;
            justify-content: space-between;
            font-size: 11.5px;
            letter-spacing: .08em;
            text-transform: uppercase;
            opacity: .8;
        }

        .galaxy-control-value {
            color: #9ec8ff;
            font-variant-numeric: tabular-nums;
        }

        .galaxy-control input[type="range"] {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 4px;
            border-radius: 4px;
            background: linear-gradient(90deg, #fff0c2, #3b82f6);
            opacity: .85;
            cursor: pointer;
        }

        .galaxy-control input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #fff8e6;
            border: 2px solid #3b82f6;
            box-shadow: 0 0 8px rgba(59,130,246,.8);
            cursor: pointer;
        }

        .galaxy-control input[type="range"]::-moz-range-thumb {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #fff8e6;
            border: 2px solid #3b82f6;
            box-shadow: 0 0 8px rgba(59,130,246,.8);
            cursor: pointer;
        }

        .galaxy-panel-colors {
            display: flex;
            justify-content: center;
            gap: 34px;
            flex-wrap: wrap;
            padding-top: 6px;
            border-top: 1px solid rgba(255,240,194,.12);
        }

        .galaxy-color {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            font-size: 11px;
            letter-spacing: .08em;
            text-transform: uppercase;
            opacity: .85;
            cursor: pointer;
        }

        .galaxy-color input[type="color"] {
            -webkit-appearance: none;
            appearance: none;
            width: 40px;
            height: 40px;
            border: none;
            border-radius: 50%;
            padding: 0;
            cursor: pointer;
            background: none;
            box-shadow: 0 0 0 2px rgba(255,240,194,.35), 0 0 14px rgba(59,130,246,.35);
        }

        .galaxy-color input[type="color"]::-webkit-color-swatch-wrapper {
            padding: 0;
            border-radius: 50%;
        }

        .galaxy-color input[type="color"]::-webkit-color-swatch {
            border: none;
            border-radius: 50%;
        }

        @media (max-width: 640px) {
            .galaxy-panel {
                padding: 14px 18px 22px;
                max-height: 78vh;
            }

            .galaxy-panel-header h3 {
                font-size: 18px;
            }

            .galaxy-panel-sliders {
                grid-template-columns: 1fr 1fr;
                gap: 12px 16px;
            }
        }

    `

    document.head.appendChild(style)

    const sliderConfigs = [
        { key: 'count', label: 'Star Count', min: 1000, max: 100000, step: 1000 },
        { key: 'size', label: 'Star Size', min: 0.001, max: 0.1, step: 0.001 },
        { key: 'radius', label: 'Galaxy Radius', min: 1, max: 20, step: 0.1 },
        { key: 'branches', label: 'Spiral Arms', min: 2, max: 10, step: 1 },
        { key: 'spin', label: 'Spin', min: -5, max: 5, step: 0.1 },
        { key: 'randomness', label: 'Randomness', min: 0, max: 1, step: 0.01 },
        { key: 'randomnessPower', label: 'Randomness Power', min: 1, max: 10, step: 0.1 }
    ]

    const colorConfigs = [
        { key: 'insideColor', label: 'Core' },
        { key: 'outsideColor', label: 'Outer' }
        
    ]

    const slidersHtml = sliderConfigs.map((cfg) => `
        <label class="galaxy-control">
            <span class="galaxy-control-label">
                <span>${cfg.label}</span>
                <span class="galaxy-control-value" data-value-for="${cfg.key}">${parameters[cfg.key]}</span>
            </span>
            <input type="range" data-key="${cfg.key}" min="${cfg.min}" max="${cfg.max}" step="${cfg.step}" value="${parameters[cfg.key]}">
        </label>
    `).join('')

    const colorsHtml = colorConfigs.map((cfg) => `
        <label class="galaxy-color">
            <input type="color" data-key="${cfg.key}" value="${parameters[cfg.key]}">
            <span>${cfg.label}</span>
        </label>
    `).join('')

    const panel = document.createElement('div')
    panel.className = 'galaxy-panel'

    panel.innerHTML = `
        <div class="galaxy-panel-handle">
            <span class="galaxy-panel-grip"></span>
            <button class="galaxy-panel-close" type="button" aria-label="Close galaxy controls">&times;</button>
        </div>
        <div class="galaxy-panel-header">
            <h3>Shape The Galaxy</h3>
            <p>Drag the controls to reshape stars, spin and color in real time</p>
        </div>
        <div class="galaxy-panel-sliders">${slidersHtml}</div>
        <div class="galaxy-panel-colors">${colorsHtml}</div>
    `

    document.body.appendChild(panel)

    panel.querySelectorAll('input[type="range"]').forEach((input) =>
    {
        const key = input.dataset.key
        const valueLabel = panel.querySelector(`[data-value-for="${key}"]`)

        input.addEventListener('input', () =>
        {
            valueLabel.textContent = input.value
        })

        input.addEventListener('change', () =>
        {
            parameters[key] = parseFloat(input.value)
            generateGalaxy()
        })
    })

    panel.querySelectorAll('input[type="color"]').forEach((input) =>
    {
        input.addEventListener('input', () =>
        {
            const key = input.dataset.key
            parameters[key] = input.value

            if(key === 'backgroundColor')
            {
                scene.background.set(parameters.backgroundColor)
            }
            else
            {
                generateGalaxy()
            }
        })
    })

    panel.querySelector('.galaxy-panel-close').addEventListener('click', () =>
    {
        toggleGalaxyGUI()
    })

    panel.querySelector('.galaxy-panel-handle').addEventListener('click', (event) =>
    {
        if(event.target.closest('.galaxy-panel-close'))
        {
            return
        }

        toggleGalaxyGUI()
    })

    return panel
}

galaxyPanel = createGalaxyControlPanel()

/**
 * =========================
 * SIZES
 * =========================
 */

const sizes =
{
    width:
        window.innerWidth,

    height:
        window.innerHeight
}


/**
 * =========================
 * CAMERA
 * =========================
 */

const camera =
    new THREE.PerspectiveCamera(

        75,

        sizes.width
        /
        sizes.height,

        0.1,

        100
    )


camera.position.set(
    0,
    3,
    8
)


scene.add(camera)


/**
 * =========================
 * CONTROLS
 * =========================
 */

const controls =
    new OrbitControls(
        camera,
        canvas
    )


controls.enableDamping =
    true


/**
 * Fixed zoom range
 */

controls.minDistance =
    3


controls.maxDistance =
    12


/**
 * Focus camera
 * on galaxy center
 */

controls.target.set(
    0,
    0,
    0
)


// =====================================================
// RESPONSIVE 3D TEXT LAYOUT
// =====================================================

const updateTextLayout = () =>
{
    
    // Text has not loaded yet
    if(
        !interactText ||
        !portfolioText ||
        !interactMobileTop ||
        !interactMobileBottom ||
        !portfolioMobile
    )
    {
        return
    }


    // ---------------------------------------------
    // Create a temporary camera representing
    // the "correct" front-facing galaxy view.
    //
    // This does NOT change the real camera.
    // ---------------------------------------------

    const layoutCamera = camera.clone()

    layoutCamera.aspect =
        sizes.width / sizes.height

    layoutCamera.updateProjectionMatrix()

    layoutCamera.position.copy(
        cameraCorrectionToPosition
    )

    layoutCamera.lookAt(
        cameraCorrectionToTarget
    )

    layoutCamera.updateMatrixWorld(true)


    // ---------------------------------------------
    // Convert a 3D point into screen X position.
    // ---------------------------------------------

    const getScreenX = (x, y, z) =>
    {
        const point =
            new THREE.Vector3(x, y, z)

        point.project(layoutCamera)

        return (
            (point.x * 0.5 + 0.5)
            *
            sizes.width
        )
    }


    // ---------------------------------------------
    // Calculate the left/right edges of the
    // desktop text.
    // ---------------------------------------------

    const interactHalfWidth =
        interactText.userData.textWidth / 2

    const portfolioHalfWidth =
        portfolioText.userData.textWidth / 2


    const desktopLeftEdge =
        getScreenX(
            -3 - interactHalfWidth,
            3,
            2
        )

    const desktopRightEdge =
        getScreenX(
            3 + portfolioHalfWidth,
            3,
            2
        )


    // Keep a little breathing room
    // from the screen edges.
    const screenPadding =
        Math.max(
            24,
            sizes.width * 0.04
        )


    // ---------------------------------------------
    // Does the desktop layout completely fit?
    // ---------------------------------------------

    const desktopFits =
        desktopLeftEdge >= screenPadding &&
        desktopRightEdge <=
            sizes.width - screenPadding


    // =================================================
    // DESKTOP
    // =================================================

    if(desktopFits)
    {
        // Show desktop text
        interactText.visible = true
        portfolioText.visible = true

        // Hide mobile text
        interactMobileTop.visible = false
        interactMobileBottom.visible = false
        portfolioMobile.visible = false


        // Keep original positions
        interactText.userData.finalPosition.set(
            -3,
            3,
            2
        )

        portfolioText.userData.finalPosition.set(
            3,
            3,
            2
        )
    }


    // =================================================
    // MOBILE / NARROW SCREEN
    // =================================================

    else
    {
        // Hide desktop text
        interactText.visible = false
        portfolioText.visible = false

        // Show mobile text
        interactMobileTop.visible = true
        interactMobileBottom.visible = true
        portfolioMobile.visible = true


        // Interact
        interactMobileTop.userData.finalPosition.set(
            0,
            3.5,
            2
        )


        // with Galaxy
        interactMobileBottom.userData.finalPosition.set(
            0,
            3.0,
            2
        )


        // Portfolio below galaxy
        portfolioMobile.userData.finalPosition.set(
            0,
            -2.8,
            2
        )
    }
}


/**
 * =========================
 * RENDERER
 * =========================
 */

const renderer =
    new THREE.WebGLRenderer({

        canvas,

        antialias:
            true
    })


renderer.setSize(
    sizes.width,
    sizes.height
)


renderer.setPixelRatio(
    Math.min(
        window.devicePixelRatio,
        2
    )
)


/**
 * Better colors
 */

renderer.toneMapping =
    THREE.ACESFilmicToneMapping


renderer.toneMappingExposure =
    1.2


/**
 * =========================
 * POST PROCESSING
 * =========================
 */

const composer =
    new EffectComposer(
        renderer
    )


/**
 * Normal scene rendering
 */

const renderPass =
    new RenderPass(
        scene,
        camera
    )


composer.addPass(
    renderPass
)


/**
 * =========================
 * BLOOM
 * =========================
 *
 * Creates the realistic
 * soft glowing effect
 */

const bloomPass =
    new UnrealBloomPass(

        new THREE.Vector2(
            sizes.width,
            sizes.height
        ),

        /**
         * Glow strength
         */

        0.25,


        /**
         * Glow radius
         */

        0.35,


        /**
         * Brightness threshold
         */

        0.65
    )


composer.addPass(
    bloomPass
)


/**
 * =========================
 * RESIZE
 * =========================
 */

window.addEventListener(
    'resize',
    () =>
    {
        sizes.width =
            window.innerWidth


        sizes.height =
            window.innerHeight


        /**
         * Camera
         */

        camera.aspect =

            sizes.width
            /
            sizes.height


        camera.updateProjectionMatrix()


        /**
         * Renderer
         */

        renderer.setSize(

            sizes.width,

            sizes.height
        )


        renderer.setPixelRatio(

            Math.min(

                window.devicePixelRatio,

                2
            )
        )


        /**
         * Composer
         */

        composer.setSize(

            sizes.width,

            sizes.height
        )
        updateTextLayout()
    }
)


/**
 * =========================
 * ANIMATION
 * =========================
 */

const clock =
    new THREE.Clock()


const tick = () =>
{
    const elapsedTime =
        clock.getElapsedTime()

    const openingTime =
        openingClock.getElapsedTime()
        // One-time camera correction after clicking
    // the galaxy center.
    if(cameraCorrectionStarted)
    {
        const correctionDuration = 1.35

        const correctionTime =
            openingTime - cameraCorrectionStart

        const correctionProgress =
            Math.min(
                correctionTime / correctionDuration,
                1
            )

        const easedCorrection =
            easeOutCubic(correctionProgress)

        // Move camera to the original/front view
        camera.position.lerpVectors(
            cameraCorrectionFromPosition,
            cameraCorrectionToPosition,
            easedCorrection
        )

        // Move OrbitControls target to galaxy center
        controls.target.lerpVectors(
            cameraCorrectionFromTarget,
            cameraCorrectionToTarget,
            easedCorrection
        )

        camera.lookAt(controls.target)

        // Correction finished
        if(correctionProgress >= 1)
        {
            camera.position.copy(cameraCorrectionToPosition)
            controls.target.copy(cameraCorrectionToTarget)

            camera.lookAt(controls.target)

            cameraCorrectionStarted = false

            // Give control back to the user
            controls.enabled = true
            controls.update()
        }
    }

    if(portfolioTravelStarted)
{
    const travelDuration = 2.2

    const travelTime =
        openingTime - portfolioTravelStart

    const travelProgress =
        Math.min(
            travelTime / travelDuration,
            1
        )

    const easedTravel =
        1 - Math.pow(1 - travelProgress, 3)


    // Move camera toward galaxy center
    camera.position.z =
        8 - easedTravel * 9

    camera.position.y =
        3 - easedTravel * 2.5


    // Look toward the galaxy center
    camera.lookAt(0, 0, 0)


    // Fade galaxy
    if(points)
    {
        points.material.opacity =
            1 - easedTravel
    }


    // Fade portfolio text
    if(textGroup)
    {
        textGroup.children.forEach((textMesh) =>
        {
            textMesh.material.opacity =
                1 - easedTravel
        })
    }


    // When travel is complete
    if(travelProgress >= 1)
{
    portfolioTravelStarted = false
    window.location.href = './solar.html'
}
}


    /**
     * Slight galaxy rotation
     *
     * Very slow so it feels
     * natural
     */

    if(points)
    {
        points.rotation.y =
            elapsedTime
            *
            0.03

        if(openingStarted)
        {
            const galaxyProgress = Math.min(
                (openingTime - galaxyOpeningStart) / 1.2,
                1
            )
            points.scale.setScalar(
                1 + 0.08 * easeOutCubic(galaxyProgress)
            )
        }
    }

    if(instructionActive && instructionGroup)
    {
        const pulse = (Math.sin(elapsedTime * Math.PI) + 1) / 2
        instructionGroup.traverse((child) =>
        {
            if(child.material)
            {
                child.material.opacity = pulse
            }
        })

       
    }

    if(openingStarted && textGroup.children.length)
    {
        const textProgress = Math.min(
            (openingTime - textAnimationStart) / 1.35,
            1
        )
        const easedProgress = easeOutCubic(textProgress)

        textGroup.children.forEach((textMesh) =>
        {
            textMesh.position.lerpVectors(
                new THREE.Vector3(0, 0, 0),
                textMesh.userData.finalPosition,
                easedProgress
            )
            textMesh.scale.setScalar(
                Math.max(0.001, easedProgress)
            )
        })
    }

    

    textGroup.children.forEach((textMesh) =>
    {
        textMesh.lookAt(camera.position)
    })


    /**
     * Controls
     */

    if(!cameraCorrectionStarted)
{
    controls.update()
}


    /**
     * Render with bloom
     */

    composer.render()


    /**
     * Next frame
     */

    window.requestAnimationFrame(
        tick
    )
}


tick()