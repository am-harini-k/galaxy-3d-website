import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import gsap from 'gsap'


// --------------------------------------------------
// DEVICE TIER
// (keeps the page from getting stuck / stuttering on
// weaker GPUs, low memory or small screens)
// --------------------------------------------------

const isSmallScreen = window.innerWidth < 780

const isLowPower =
    isSmallScreen ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
    /Mobi|Android/i.test(navigator.userAgent)

const maxPixelRatio = isLowPower ? 1.4 : 2


// --------------------------------------------------
// BASIC SETUP
// --------------------------------------------------

const canvas = document.querySelector('canvas.webgl')

const scene = new THREE.Scene()

scene.background = new THREE.Color('#020307')


const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}


// --------------------------------------------------
// CAMERA
// --------------------------------------------------

const NORMAL_FOV = 42
const WARP_FOV = isLowPower ? 62 : 82

const camera = new THREE.PerspectiveCamera(
    42,
    sizes.width / sizes.height,
    .1,
    280
)

// Start tucked behind and beside the Sun, aimed diagonally down
// the row of planets with a narrow (telephoto) lens — this is what
// compresses the depth and lines the planets up left-to-right,
// large Sun in the foreground, just like the reference illustration.
camera.position.set(-6, 4.2, 16)

scene.add(camera)


// --------------------------------------------------
// OVERVIEW / CINEMATIC TARGETS
// --------------------------------------------------

const INTRO_TARGET = new THREE.Vector3(15, -0.5, 0)

const OVERVIEW_POSITION = new THREE.Vector3(4, 9.5, 28)
const OVERVIEW_TARGET = new THREE.Vector3(6, 0, 0)

const OVERVIEW_DIRECTION =
    new THREE.Vector3()
        .subVectors(
            OVERVIEW_POSITION,
            OVERVIEW_TARGET
        )

const RESPONSIVE_OVERVIEW_POSITION =
    new THREE.Vector3()

const lookTarget = INTRO_TARGET.clone()
camera.lookAt(lookTarget)


// --------------------------------------------------
// RENDERER
// --------------------------------------------------

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isLowPower,
    powerPreference: 'high-performance'
})

renderer.setSize(
    sizes.width,
    sizes.height
)

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, maxPixelRatio)
)

renderer.outputColorSpace = THREE.SRGBColorSpace

renderer.toneMapping = THREE.ACESFilmicToneMapping

renderer.toneMappingExposure = 1.12


// --------------------------------------------------
// RECOVER GRACEFULLY FROM GPU / CONTEXT PROBLEMS
// (this is usually what makes a WebGL page look "stuck")
// --------------------------------------------------

let contextLost = false

canvas.addEventListener('webglcontextlost', (event) => {

    event.preventDefault()
    contextLost = true
    showFatalMessage('The 3D scene lost its graphics context. Tap to reload.')

})

canvas.addEventListener('webglcontextrestored', () => {

    window.location.reload()

})

const showFatalMessage = (text) => {

    const overlay = document.createElement('div')
    overlay.className = 'solar-fatal-overlay'
    overlay.textContent = text

    overlay.addEventListener('click', () => window.location.reload())

    document.body.appendChild(overlay)
}


// --------------------------------------------------
// BLOOM
// --------------------------------------------------

const composer = new EffectComposer(renderer)

composer.addPass(
    new RenderPass(scene, camera)
)

const bloomResolutionScale = isLowPower ? .6 : 1

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(
        sizes.width * bloomResolutionScale,
        sizes.height * bloomResolutionScale
    ),
    isLowPower ? .55 : .68,
    .74,
    .58
)

composer.addPass(bloomPass)


// --------------------------------------------------
// ORBIT CONTROLS
// --------------------------------------------------

const controls = new OrbitControls(
    camera,
    canvas
)

const updateResponsiveOverviewCamera = () => {

    const aspect =
        sizes.width / sizes.height

    // Normal desktop view
    // Only zoom out when the screen becomes narrow.
    const referenceAspect = 1.5

    const zoomOut =
        Math.max(
            1,
            referenceAspect / aspect
        )

    RESPONSIVE_OVERVIEW_POSITION
        .copy(OVERVIEW_TARGET)
        .addScaledVector(
            OVERVIEW_DIRECTION,
            zoomOut
        )

    camera.position.copy(
        RESPONSIVE_OVERVIEW_POSITION
    )

    controls.target.copy(
        OVERVIEW_TARGET
    )

    camera.lookAt(
        controls.target
    )

    controls.update()
}

controls.enableDamping = true

controls.dampingFactor = .045

controls.minDistance = 6

controls.maxDistance = 105

controls.enablePan = true

controls.screenSpacePanning = true

controls.target.copy(OVERVIEW_TARGET)

// Controls stay off until the intro cinematic hands over control
controls.enabled = false


// --------------------------------------------------
// LOADING MANAGER + PRELOADER
// --------------------------------------------------

const loadingManager = new THREE.LoadingManager()

const buildLoadingScreen = () => {

    const style = document.createElement('style')

    style.textContent = `

        .solar-loader {
            position: fixed;
            inset: 0;
            z-index: 100;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 18px;
            background: radial-gradient(ellipse at 30% 40%, #0a0e1e 0%, #000005 70%);
            color: #fff0c2;
            font-family: Georgia, serif;
            letter-spacing: .16em;
            transition: opacity .8s ease;
        }

        .solar-loader-title {
            font-size: 15px;
            text-transform: uppercase;
            opacity: .85;
        }

        .solar-loader-track {
            width: min(320px, 70vw);
            height: 3px;
            border-radius: 3px;
            background: rgba(255,255,255,.12);
            overflow: hidden;
        }

        .solar-loader-fill {
            height: 100%;
            width: 0%;
            border-radius: 3px;
            background: linear-gradient(90deg, #fff0c2, #3b82f6);
            transition: width .25s ease;
        }

        .solar-loader-percent {
            font-size: 11px;
            opacity: .55;
        }

        .solar-fatal-overlay {
            position: fixed;
            inset: 0;
            z-index: 200;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 32px;
            background: rgba(0,0,0,.88);
            color: #fff0c2;
            font-family: Georgia, serif;
            font-size: 16px;
            letter-spacing: .06em;
            cursor: pointer;
        }

    `

    document.head.appendChild(style)

    const loader = document.createElement('div')
    loader.className = 'solar-loader'

    loader.innerHTML = `
        <div class="solar-loader-title">Entering the Solar System</div>
        <div class="solar-loader-track"><div class="solar-loader-fill"></div></div>
        <div class="solar-loader-percent">0%</div>
    `

    document.body.appendChild(loader)

    return loader
}

const loaderEl = buildLoadingScreen()
const loaderFill = loaderEl.querySelector('.solar-loader-fill')
const loaderPercent = loaderEl.querySelector('.solar-loader-percent')

loadingManager.onProgress = (url, loaded, total) => {

    const percent = Math.min(100, Math.round((loaded / Math.max(total, 1)) * 100))
    loaderFill.style.width = `${percent}%`
    loaderPercent.textContent = `${percent}%`

}

loadingManager.onError = (url) => {

    console.warn('Could not load asset:', url)

}

let sceneReady = false

const dismissLoader = () => {

    if(sceneReady)
    {
        return
    }

    sceneReady = true

    loaderFill.style.width = '100%'
    loaderEl.style.opacity = '0'

    window.setTimeout(() => {
        loaderEl.remove()
    }, 850)

    showWelcomeScreen()
}

loadingManager.onLoad = dismissLoader

// Safety net: never let the page appear stuck forever,
// even if one texture silently fails to fire its callback.
// Safety net: only dismiss the loader if the assets
// are still loading after 9 seconds.
window.setTimeout(() => {

    if (!sceneReady)
    {
        console.warn(
            'Loading took longer than expected. Starting the scene anyway.'
        )

        dismissLoader()
    }

}, 9000)


// --------------------------------------------------
// TEXTURES
// --------------------------------------------------

const textureLoader = new THREE.TextureLoader(loadingManager)

const textureRoot = '/'

const textureFiles = {

    stars: '2k_stars_milky_way.jpg',

    sun: '2k_sun.jpg',

    earthDay: '2k_earth_daymap.jpg',

    earthNight: '2k_earth_nightmap.jpg',

    mercury: '2k_mercury.jpg',

    venus: '2k_venus_surface.jpg',

    venusAtmosphere: '2k_venus_atmosphere.jpg',

    mars: '2k_mars.jpg',

    jupiter: '2k_jupiter.jpg',

    saturn: '2k_saturn.jpg',

    saturnRing: '2k_saturn_ring_alpha.png',

    uranus: '2k_uranus.jpg',

    neptune: '2k_neptune.jpg'

}


const fallbackColors = {

    mercury: '#978c80',

    venus: '#c9945b',

    earth: '#3b75a9',

    mars: '#a24e32',

    jupiter: '#c69f7a',

    saturn: '#d1b98b',

    uranus: '#82cbd1',

    neptune: '#426cb4'

}


const textures = new Map()


const loadTexture = (name) => {

    if (!textureFiles[name])
        return null

    if (textures.has(name))
        return textures.get(name)


    const texture = textureLoader.load(

        `${textureRoot}${textureFiles[name]}`,

        (loaded) => {

            loaded.colorSpace =
                THREE.SRGBColorSpace

        },

        undefined,

        () => {

            textures.set(name, null)

        }

    )


    texture.colorSpace =
        THREE.SRGBColorSpace

    texture.anisotropy = isLowPower ? 1 : 4

    textures.set(name, texture)

    return texture
}


// --------------------------------------------------
// MILKY WAY BACKGROUND
// --------------------------------------------------

const createMilkyWay = () => {

    const texture =
        loadTexture('stars')


    const sky = new THREE.Mesh(

        new THREE.SphereGeometry(
            150,
            isLowPower ? 32 : 64,
            isLowPower ? 16 : 32
        ),

        new THREE.MeshBasicMaterial({

            map: texture,

            side: THREE.BackSide,

            depthWrite: false

        })

    )


    // Rotate so the bright band of the galaxy sweeps
    // diagonally behind the planet row, like the reference image
    sky.rotation.set(0.35, 1.1, 0.25)

    sky.renderOrder = -10
    scene.add(sky)
}


// --------------------------------------------------
// AMBIENT FILL LIGHT
// --------------------------------------------------

scene.add(new THREE.HemisphereLight('#3b5aa8', '#05040a', .16))


// --------------------------------------------------
// UI — TITLE / HINT
// --------------------------------------------------

const createInterface = () => {

    const style =
        document.createElement('style')


    style.textContent = `

        .solar-hud {

            position: fixed;

            inset: 0;

            pointer-events: none;

            color: #eee8dc;

            font-family: Georgia, serif;

            letter-spacing: .14em;

            opacity: 0;

            transition: opacity 1s ease;

        }

        .solar-hud.solar-hud--visible {
            opacity: 1;
        }


        .solar-title {

    position: absolute;

    top: clamp(18px, 3vw, 34px);

    left: clamp(16px, 4vw, 52px);

    color: #fff1bd;

    font-size: clamp(20px, 3vw, 46px);

    letter-spacing: .04em;

    text-transform: uppercase;

    text-shadow:
        0 0 20px rgba(255,220,150,.18);

}


        .solar-hint {

    position: absolute;

    bottom: clamp(16px, 3vw, 34px);

    left: clamp(16px, 4vw, 52px);

    max-width: calc(100vw - 32px);

    color: #eee8dc;

    opacity: .72;

    font-size: clamp(9px, 1.2vw, 15px);

    letter-spacing: .12em;

    text-transform: uppercase;

    transition: opacity .5s ease;

}


        @media(max-width: 700px) {

    .solar-title {

        top: 22px;

        left: 24px;

        font-size: clamp(20px, 7vw, 30px);

    }


    .solar-hint {

        left: 24px;

        bottom: 20px;

        font-size: 10px;

    }

}

    `


    document.head.appendChild(style)


    const hud =
        document.createElement('div')


    hud.className = 'solar-hud'


    hud.innerHTML = `

        <div class="solar-title">

            THE SOLAR SYSTEM

        </div>


        <div class="solar-hint" id="solarHint">

            DRAG TO EXPLORE · CLICK A PLANET TO TRAVEL

        </div>

    `


    document.body.appendChild(hud)

    return hud

}


const hud = createInterface()
const solarHint = hud.querySelector('#solarHint')


// --------------------------------------------------
// WELCOME SCREEN
// The scene remains visible behind this screen until the
// visitor starts the existing intro camera animation.
// --------------------------------------------------

const welcomeStyle = document.createElement('style')

welcomeStyle.textContent = `
    .solar-welcome {
        position: fixed;
        inset: 0;
        z-index: 40;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background:
            radial-gradient(circle at 50% 42%, rgba(20, 37, 75, .2), transparent 45%),
            rgba(1, 3, 10, .34);
        color: #fff0c2;
        font-family: Georgia, serif;
        text-align: center;
        transition: opacity .65s ease, visibility .65s ease;
    }

    .solar-welcome--leaving {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
    }

    .solar-welcome-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 18px;
        transform: translateY(0);
        transition: transform .65s ease;
    }

    .solar-welcome-title {
        position: relative;
        z-index: 1;
    }

    .solar-welcome--leaving .solar-welcome-eyebrow,
    .solar-welcome--leaving .solar-welcome-rule,
    .solar-welcome--leaving .solar-welcome-copy,
    .solar-welcome--leaving .solar-welcome-button {
        opacity: 0;
        transform: translateY(14px);
        transition: opacity .45s ease, transform .45s ease;
    }

    .solar-welcome-eyebrow {
        color: #aab9dc;
        font-size: clamp(10px, 1.2vw, 14px);
        letter-spacing: .35em;
        text-transform: uppercase;
    }

    .solar-welcome-title {
        margin: 0;
        color: #ffffff;
        font-size: clamp(42px, 8vw, 92px);
        font-weight: 400;
        letter-spacing: .06em;
        line-height: .95;
        text-shadow: 0 0 30px rgba(156, 190, 255, .22);
    }

    .solar-welcome-rule {
        width: min(360px, 62vw);
        height: 2px;
        background: linear-gradient(90deg, transparent, #6fa2ff, transparent);
        box-shadow: 0 0 14px rgba(111, 162, 255, .45);
    }

    .solar-welcome-copy {
        max-width: 520px;
        margin: 0;
        color: #c4cce0;
        font-size: clamp(12px, 1.35vw, 16px);
        letter-spacing: .04em;
        line-height: 1.7;
    }

    .solar-welcome-button {
        margin-top: 18px;
        padding: 11px 25px;
        border: 1px solid #4b8dff;
        border-radius: 999px;
        background: rgba(8, 18, 44, .72);
        color: #ffffff;
        font: 16px Georgia, serif;
        letter-spacing: .03em;
        cursor: pointer;
        box-shadow: 0 0 18px rgba(43, 111, 255, .18);
        transition: transform .25s ease, background .25s ease, box-shadow .25s ease;
    }

    .solar-welcome-button:hover {
        transform: translateY(-3px);
        background: rgba(39, 82, 170, .72);
        box-shadow: 0 8px 28px rgba(43, 111, 255, .32);
    }

    .solar-welcome-button:focus-visible {
        outline: 2px solid #c5d5ff;
        outline-offset: 4px;
    }

    @media (max-width: 600px) {
        .solar-welcome-title {
            font-size: clamp(34px, 12vw, 62px);
        }

        .solar-welcome-copy {
            max-width: 330px;
        }
    }
`

document.head.appendChild(welcomeStyle)

const welcomeScreen = document.createElement('section')
welcomeScreen.className = 'solar-welcome'
welcomeScreen.setAttribute('aria-label', 'Welcome to Harini K interactive portfolio')
welcomeScreen.innerHTML = `
    <div class="solar-welcome-content">
        <div class="solar-welcome-eyebrow">Explore our</div>
        <h1 class="solar-welcome-title">Solar System</h1>
        <div class="solar-welcome-rule"></div>
        <p class="solar-welcome-copy">
            Welcome to my interactive portfolio. Travel through the planets
            to discover my profile, skills, projects, and experience.
        </p>
        <button class="solar-welcome-button" type="button">
            Get Started
        </button>
    </div>
`

document.body.appendChild(welcomeScreen)

const welcomeButton = welcomeScreen.querySelector('.solar-welcome-button')
let welcomeStarted = false

const showWelcomeScreen = () => {
    welcomeScreen.classList.remove('solar-welcome--leaving')
    welcomeButton.focus({ preventScroll: true })
}

const startSolarExperience = () => {
    if(welcomeStarted)
    {
        return
    }

    welcomeStarted = true
    welcomeButton.disabled = true

    welcomeScreen.classList.add('solar-welcome--leaving')

    beginIntro()

    window.setTimeout(() => {
        welcomeScreen.remove()
    }, 700)
}

welcomeButton.addEventListener('click', startSolarExperience)


// --------------------------------------------------
// EXTRA STAR PARTICLES
// --------------------------------------------------

const createStars = () => {

    const count = isLowPower ? 4200 : 9000


    const positions =
        new Float32Array(count * 3)

    const colors =
        new Float32Array(count * 3)


    const color = new THREE.Color()


    for (
        let index = 0;
        index < count;
        index++
    ) {

        const i3 = index * 3


        const radius =
            70 + Math.random() * 105


        const theta =
            Math.random() * Math.PI * 2


        const phi =
            Math.acos(
                2 * Math.random() - 1
            )


        positions[i3] =
            radius *
            Math.sin(phi) *
            Math.cos(theta)


        positions[i3 + 1] =
            radius *
            Math.cos(phi)


        positions[i3 + 2] =
            radius *
            Math.sin(phi) *
            Math.sin(theta)


        color.setHSL(

            .56 +
            Math.random() * .12,

            .18 +
            Math.random() * .25,

            .55 +
            Math.random() * .45

        )


        colors[i3] = color.r

        colors[i3 + 1] = color.g

        colors[i3 + 2] = color.b

    }


    const geometry =
        new THREE.BufferGeometry()


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


    const material =
        new THREE.PointsMaterial({

            size: .11,

            sizeAttenuation: true,

            vertexColors: true,

            transparent: true,

            opacity: .8,

            depthWrite: false

        })


    scene.add(
        new THREE.Points(
            geometry,
            material
        )
    )
}


// --------------------------------------------------
// EARTH NIGHT LIGHTS
// --------------------------------------------------

const createEarthNightLayer = (radius) => {

    const material =
        new THREE.ShaderMaterial({

            uniforms: {

                nightMap: {
                    value: loadTexture(
                        'earthNight'
                    )
                }

            },


            vertexShader: `

                varying vec3 worldNormal;

                varying vec3 worldPosition;

                varying vec2 vUv;


                void main()
                {

                    vUv = uv;


                    worldNormal =
                        normalize(
                            mat3(modelMatrix)
                            * normal
                        );


                    vec4 world =
                        modelMatrix *
                        vec4(
                            position,
                            1.0
                        );


                    worldPosition =
                        world.xyz;


                    gl_Position =
                        projectionMatrix *
                        viewMatrix *
                        world;

                }

            `,


            fragmentShader: `

                uniform sampler2D nightMap;


                varying vec3 worldNormal;

                varying vec3 worldPosition;

                varying vec2 vUv;


                void main()
                {

                    vec3 toSun =
                        normalize(
                            -worldPosition
                        );


                    float night =
                        smoothstep(
                            .18,
                            -.18,
                            dot(
                                normalize(
                                    worldNormal
                                ),
                                toSun
                            )
                        );


                    vec4 light =
                        texture2D(
                            nightMap,
                            vUv
                        );


                    gl_FragColor =
                        vec4(
                            light.rgb,
                            light.a *
                            night *
                            .72
                        );

                }

            `,


            transparent: true,

            blending:
                THREE.AdditiveBlending,

            depthWrite: false,

            side: THREE.FrontSide

        })


    return new THREE.Mesh(

        new THREE.SphereGeometry(
            radius * 1.006,
            isLowPower ? 28 : 48,
            isLowPower ? 20 : 32
        ),

        material

    )
}


// --------------------------------------------------
// SOFT RADIAL GLOW TEXTURE (canvas-generated)
// used for the Sun's corona + prominence sprites so
// every glow fades out smoothly with no hard edge/outline
// --------------------------------------------------

const glowTextureCache = new Map()

const createRadialGlowTexture = (stops, size = 256) => {

    const cacheKey = JSON.stringify(stops) + size

    if(glowTextureCache.has(cacheKey))
    {
        return glowTextureCache.get(cacheKey)
    }

    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size

    const ctx = canvas.getContext('2d')
    const gradient = ctx.createRadialGradient(
        size / 2, size / 2, 0,
        size / 2, size / 2, size / 2
    )

    stops.forEach(([offset, color]) => gradient.addColorStop(offset, color))

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true

    glowTextureCache.set(cacheKey, texture)

    return texture
}


// --------------------------------------------------
// SUN
// --------------------------------------------------

const createSun = () => {

    const group = new THREE.Group()


    // -----------------------------
    // Main Sun surface — a real photo texture, with a
    // fresnel-driven limb brightening injected via
    // onBeforeCompile so the edge glows into the corona
    // instead of just cutting off into a flat/brown ring.
    // -----------------------------

    const sunMaterial = new THREE.MeshBasicMaterial({

        map: loadTexture('sun'),

        color: '#ffffff'

    })

    sunMaterial.toneMapped = false

    sunMaterial.onBeforeCompile = (shader) => {

        shader.uniforms.uTime = { value: 0 }

        
shader.vertexShader = shader.vertexShader
    .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vSunNormal;
        varying vec3 vSunViewPosition;
        varying vec2 vUv;`
    )

            
.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
    vUv = uv;
    vSunNormal = normalize( normalMatrix * normal );
    vSunViewPosition = -( modelViewMatrix * vec4( position, 1.0 ) ).xyz;`
)


        shader.fragmentShader = shader.fragmentShader
    .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vSunNormal;
        varying vec3 vSunViewPosition;
        varying vec2 vUv;
        uniform float uTime;`
    )
            .replace(
                '#include <map_fragment>',
                `#include <map_fragment>
                {
                    // brighten + saturate the base plasma texture a touch
                    diffuseColor.rgb = pow( diffuseColor.rgb, vec3( 0.82 ) );

                    // subtle boiling-plasma flicker
                    float flicker = 0.94 + 0.06 * sin(
                        uTime * 1.6 + vUv.x * 26.0 + vUv.y * 14.0
                    );
                    diffuseColor.rgb *= flicker;

                    // fresnel limb brightening — glows hot white/yellow
                    // at the edge instead of leaving a flat, dark ring
                    vec3 viewDir = normalize( vSunViewPosition );
                    float fresnel = pow(
                        1.0 - clamp( dot( normalize( vSunNormal ), viewDir ), 0.0, 1.0 ),
                        2.1
                    );
                    vec3 limbColor = vec3( 1.0, 0.78, 0.42 );
                    diffuseColor.rgb = mix( diffuseColor.rgb, limbColor, fresnel * 0.92 );
                    diffuseColor.rgb += limbColor * fresnel * fresnel * 0.5;
                }`
            )

        sunMaterial.userData.shader = shader
    }

    const sun = new THREE.Mesh(

        new THREE.SphereGeometry(
            2.25,
            isLowPower ? 40 : 64,
            isLowPower ? 40 : 64
        ),

        sunMaterial

    )


    // -----------------------------
    // Corona — soft, layered radial-gradient sprites.
    // Sprites always face the camera and fade to fully
    // transparent at their edge, so there is never a hard
    // circular outline like a plain sphere glow gives you.
    // -----------------------------

    const coronaGroup = new THREE.Group()

    const coronaLayers = [
        {
            size: 5.6,
            stops: [
                [0.0, 'rgba(255,247,214,0.75)'],
                [0.35, 'rgba(255,206,120,0.4)'],
                [1.0, 'rgba(255,150,50,0)']
            ]
        },
        {
            size: 8.6,
            stops: [
                [0.0, 'rgba(255,190,110,0.32)'],
                [0.5, 'rgba(255,130,50,0.16)'],
                [1.0, 'rgba(255,90,30,0)']
            ]
        },
        {
            size: 13.5,
            stops: [
                [0.0, 'rgba(255,140,60,0.16)'],
                [0.55, 'rgba(240,90,40,0.07)'],
                [1.0, 'rgba(200,60,20,0)']
            ]
        }
    ]

    coronaLayers.forEach((layer) => {

        const material = new THREE.SpriteMaterial({
            map: createRadialGlowTexture(layer.stops),
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        })

        const sprite = new THREE.Sprite(material)
        sprite.scale.set(layer.size, layer.size, 1)
        sprite.userData.baseScale = layer.size

        coronaGroup.add(sprite)

    })


    // -----------------------------
    // Prominence flares — a couple of small, elongated
    // gradient sprites near the limb, like the arcing
    // plasma loop in the reference photo. Purely decorative,
    // gently pulsing so the Sun feels alive rather than static.
    // -----------------------------

    const flareTexture = createRadialGlowTexture([
        [0.0, 'rgba(255,205,140,0.85)'],
        [0.4, 'rgba(255,120,50,0.45)'],
        [1.0, 'rgba(200,50,20,0)']
    ])

    const flareConfigs = [
        { angle: 2.15, distance: 2.15, scale: [1.1, 2.0] },
        { angle: -0.6, distance: 2.05, scale: [0.85, 1.5] }
    ]

    const flares = flareConfigs.map((config) => {

        const material = new THREE.SpriteMaterial({
            map: flareTexture,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            opacity: .8
        })

        const sprite = new THREE.Sprite(material)

        sprite.position.set(
            Math.cos(config.angle) * config.distance,
            Math.sin(config.angle) * config.distance,
            0
        )

        sprite.scale.set(config.scale[0], config.scale[1], 1)
        sprite.userData.phase = Math.random() * Math.PI * 2

        return sprite

    })

    flares.forEach((flare) => coronaGroup.add(flare))


    // -----------------------------
    // Sun light
    // -----------------------------

    const light = new THREE.PointLight(

        '#ffd28a',

        240,

        140,

        1.35

    )


    group.add(
        sun,
        coronaGroup,
        light
    )


    scene.add(group)


    return {

        group,

        sun,
        coronaGroup,
        flares

    }

}


// --------------------------------------------------
// ORBIT LINES
// --------------------------------------------------

const createOrbit = (radius) => {

    const points =

        new THREE.EllipseCurve(
            0,
            0,
            radius,
            radius
        )

        .getPoints(128)

        .map(

            (point) =>

                new THREE.Vector3(
                    point.x,
                    0,
                    point.y
                )

        )


    const geometry =
        new THREE.BufferGeometry()
            .setFromPoints(points)


    const material =
        new THREE.LineBasicMaterial({

            color: '#777d91',

            transparent: true,

            opacity: .18

        })


    const line = new THREE.LineLoop(
        geometry,
        material
    )

    scene.add(line)

    return line
}


// --------------------------------------------------
// PLANET DATA
// --------------------------------------------------

const planetData = [

    {
        name: 'Mercury',
        key: 'mercury',
        radius: .34,
        orbit: 4.3,
        speed: .42,
        tilt: .03,
        rotation: .7,
        accent: '#c9beae',
        frame: 1
    },

    {
        name: 'Venus',
        key: 'venus',
        radius: .52,
        orbit: 6,
        speed: .31,
        tilt: .04,
        rotation: -.25,
        accent: '#e8c99a',
        frame: 1
    },

    {
        name: 'Earth',
        key: 'earth',
        radius: .58,
        orbit: 7.8,
        speed: .24,
        tilt: .41,
        rotation: 1.25,
        accent: '#5fa8e0',
        frame: 1
    },

    {
        name: 'Mars',
        key: 'mars',
        radius: .43,
        orbit: 9.7,
        speed: .19,
        tilt: .44,
        rotation: 1.1,
        accent: '#e0805a',
        frame: 1
    },

    {
        name: 'Jupiter',
        key: 'jupiter',
        radius: 1.28,
        orbit: 14.2,
        speed: .105,
        tilt: .05,
        rotation: 2,
        accent: '#d9b58c',
        frame: 1.35
    },

    {
        name: 'Saturn',
        key: 'saturn',
        radius: 1.08,
        orbit: 18.8,
        speed: .078,
        tilt: .47,
        rotation: 1.7,
        accent: '#e3d3a4',
        frame: 1.9
    },

    {
        name: 'Uranus',
        key: 'uranus',
        radius: .76,
        orbit: 23.1,
        speed: .055,
        tilt: 1.71,
        rotation: 1.2,
        accent: '#9fe3e8',
        frame: 1.15
    },

    {
        name: 'Neptune',
        key: 'neptune',
        radius: .74,
        orbit: 27.1,
        speed: .043,
        tilt: .49,
        rotation: 1.25,
        accent: '#7d9fe8',
        frame: 1.15
    }

]


// --------------------------------------------------
// PER-PLANET INFO CONTENT
// (leave as placeholders — fill these in later)
// --------------------------------------------------


const planetInfo = {

    // 1. MERCURY — ABOUT ME
    mercury: {
        title: 'About Me',
        body: `
            <div class="pi-section">
                <h3>Hi, I'm Harini K</h3>

                <p class="pi-sub">
                    Aspiring Software Engineer | AI &amp; Data Science Student
                </p>

                <p>
                    I'm a third-year B.Tech Artificial Intelligence
                    and Data Science student passionate about building
                    practical software solutions and exploring
                    AI-powered applications. I enjoy solving problems,
                    learning new technologies, and turning ideas into
                    functional projects.
                </p>

                <p>
                    I'm currently strengthening my programming and
                    problem-solving skills while looking for internship
                    opportunities where I can contribute, learn, and
                    grow as a software engineer.
                </p>

            </div>
        `
    },


    // 2. VENUS — SKILLS
    venus: {
        title: 'Skills',
        body: `
            <div class="pi-section">
                <h4>Programming Languages</h4>
                <div class="pi-chips">
                    <span class="pi-chip">Python</span>
                    <span class="pi-chip">Java</span>
                    <span class="pi-chip">C</span>
                    <span class="pi-chip">SQL</span>
                </div>

                <h4>Frameworks and libraries</h4>
                <div class="pi-chips">
                    <span class="pi-chip">Numpy</span>
                    <span class="pi-chip">3.js</span>
                    <span class="pi-chip">Next.js</span>
                </div>

                <h4>Tools</h4>
                <div class="pi-chips">
                    <span class="pi-chip">Powerbi</span>
                    <span class="pi-chip">postgresql</span>
                </div>

                <h4>Technologies</h4>
                <div class="pi-chips">
                    <span class="pi-chip">Machine Learning Fundamentals</span>
                    <span class="pi-chip">Retrieval-Augmented Generation (RAG)</span>
                    <span class="pi-chip">Deep learning</span>
                </div>

                <h4>Soft Skills</h4>
                <ul class="pi-list">
                    <li>Problem Solving</li>
                    <li>Team Collaboration</li>
                    <li>Adaptability</li>
                    <li>Continuous Learning</li>
                </ul>
            </div>
        `
    },


    // 3. EARTH — EDUCATION
    earth: {
        title: 'Education',
        body: `
            <div class="pi-section">
                <div class="pi-timeline">
                    <div class="pi-step">
                        <span class="pi-dot"></span>

                        <h4>Bachelor of Technology (B.Tech)</h4>

                        <p class="pi-sub">
                            Artificial Intelligence and Data Science
                        </p>

                        <p>
                            Sri Manakula Vinayagar Engineering College
                        </p>

                        <div class="pi-chips">
                            <span class="pi-chip">Current Year: Third Year</span>
                            <span class="pi-chip">Current CGPA: 9.25/10</span>
                        </div>
                    </div>

                    <div class="pi-step">
                        <span class="pi-dot"></span>

                        <h4>Higher Secondary Education</h4>

                        <p>
                            HSC — Achariya Siksha Mandir Higher Secondary School
                        </p>

                        <div class="pi-chips">
                            <span class="pi-chip">HSC Percentage: 87.6%</span>
                        </div>
                    </div>

                    <div class="pi-step">
                        <span class="pi-dot"></span>

                        <h4>Secondary Education</h4>

                        <p>
                            SSLC — Shree Azhagappa English High School
                        </p>

                        <div class="pi-chips">
                            <span class="pi-chip">SSLC Percentage: 89.4%</span>
                        </div>
                    </div>
                </div>
            </div>
        `
    },


    // 4. MARS — PROJECTS
    mars: {
        title: 'Projects',
        body: `
            <div class="pi-section">

                <div class="pi-project">
                    <h4>Privacy Decision Support System</h4>

                    <p>
                        A mobile application designed to help users
                        understand privacy policies and identify
                        potential privacy risks using AI-powered
                        explanations.
                    </p>

                    <p class="pi-project-tech">
                        <strong>Tech:</strong> Flutter, Dart, Gemini API,
                        Android Accessibility Service, Machine Learning
                    </p>

                    <div class="pi-chips">
                        <span class="pi-chip">Flutter</span>
                        <span class="pi-chip">Dart</span>
                        <span class="pi-chip">Gemini API</span>
                        <span class="pi-chip">Machine Learning</span>
                    </div>

                    <a class="pi-button"
                       href="https://github.com/am-harini-k/Privacy_decision_support_SD"
                       target="_blank"
                       rel="noopener noreferrer">
                        View GitHub Repository
                    </a>
                </div>


                <div class="pi-project">
                    <h4>AI-Powered Ticket Management System</h4>

                    <p>
                        A web-based ticketing platform for managing
                        customer support requests, assigning tickets
                        to employees, handling attachments, and
                        generating AI-assisted ticket summaries.
                    </p>

                    <p class="pi-project-tech">
                        <strong>Tech:</strong> Next.js, Node.js,
                        PostgreSQL, Nodemailer, AI integration
                    </p>

                    <div class="pi-chips">
                        <span class="pi-chip">Next.js</span>
                        <span class="pi-chip">Node.js</span>
                        <span class="pi-chip">PostgreSQL</span>
                        <span class="pi-chip">AI integration</span>
                    </div>

                    <a class="pi-button"
                       href="https://github.com/am-harini-k/ticket-app/tree/master"
                       target="_blank"
                       rel="noopener noreferrer">
                        View GitHub Repository
                    </a>
                </div>


                <div class="pi-project">
                    <h4>LapDoctor — System Utility</h4>

                    <p>
                        A desktop utility built to monitor system
                        resources and identify duplicate files using
                        file hashing, helping users inspect and manage
                        their computer more efficiently.
                    </p>

                    <p class="pi-project-tech">
                        <strong>Tech:</strong> Python, CustomTkinter,
                        psutil, os, shutil, hashlib
                    </p>

                    <div class="pi-chips">
                        <span class="pi-chip">Python</span>
                        <span class="pi-chip">CustomTkinter</span>
                        <span class="pi-chip">psutil</span>
                        <span class="pi-chip">hashlib</span>
                    </div>

                    <a class="pi-button"
                       href="https://github.com/am-harini-k/device_management"
                       target="_blank"
                       rel="noopener noreferrer">
                        View GitHub Repository
                    </a>
                </div>

            </div>
        `
    },


    // 5. JUPITER — EXPERIENCE
    jupiter: {
        title: 'Experience',
        body: `
            <div class="pi-section">
                <h4>Academic and Personal Projects</h4>

                <ul class="pi-list">
                    <li>
                        Developed software applications combining
                        frontend development, backend services,
                        databases, and AI integration.
                    </li>

                    <li>
                        Worked with Flutter, Python, JavaScript,
                        and PostgreSQL to implement practical
                        project features.
                    </li>

                    <li>
                        Explored AI-powered explanations and
                        automated summarization in application
                        workflows.
                    </li>

                    <li>
                        Practiced debugging, integrating APIs,
                        and managing code with Git and GitHub.
                    </li>
                </ul>

                <div class="pi-project">
                    <h4>Hackathon Experience</h4>

                    <p>
                        Participated in competitive project
                        development events, collaborating to
                        build solutions under time constraints
                        and present working project ideas.
                    </p>
                </div>
            </div>
        `
    },


    // 6. SATURN — AWARDS & RECOGNITION
    saturn: {
        title: 'Awards & Recognition',
        body: `
            <div class="pi-section">
                <div class="pi-award">
                    <div>
                        <strong>
                            2nd Prize — SCIMIT Project Expo 2026
                        </strong>
                    </div>
                </div>

                <div class="pi-award">
                    <div>
                        <strong>
                            3rd Prize — National Hackathon
                        </strong>
                        <p>
                            Achariya College of Engineering Technology,
                            Puducherry, 2026
                        </p>
                    </div>
                </div>

                <div class="pi-award">
                    <div>
                        <strong>
                            Special Jury Prize — IGNITE 2026
                        </strong>
                        <p>
                            St. Joseph's, 13 March 2026
                        </p>
                    </div>
                </div>

            </div>
        `
    },


    // 7. URANUS — INTERESTS
    uranus: {
        title: 'Interests',
        body: `
            <div class="pi-section">
                <h4>Beyond Coding</h4>

                <p>
                    I'm always curious about how technology can solve
                    real-world problems. Beyond building personal
                    projects, I'm interested in applying my skills to
                    meaningful work, collaborating with others, and
                    learning through practical experience.
                </p>

                <ul class="pi-list">
                    <li>
                        <strong>Internship Opportunities:</strong>
                        Looking for opportunities to contribute to
                        real-world software and AI projects while
                        learning from experienced developers.
                    </li>

                    <li>
                        <strong>Collaboration:</strong> Interested in
                        working with developers, startups, and teams
                        to turn ideas into useful software solutions.
                    </li>

                    <li>
                        <strong>Continuous Learning:</strong> Exploring
                        new technologies, improving my problem-solving
                        skills, and strengthening my development skills
                        through hands-on projects.
                    </li>
                </ul>

                <div class="pi-action-row">
                    <a class="pi-button"
                       href="https://github.com/am-harini-k"
                       target="_blank"
                       rel="noopener noreferrer">
                        Explore My Work
                    </a>

                    <a class="pi-button pi-button-secondary"
                       href="https://www.linkedin.com/in/harini-k06"
                       target="_blank"
                       rel="noopener noreferrer">
                        Connect on LinkedIn
                    </a>
                </div>
            </div>
        `
    },


    // 8. NEPTUNE — CONTACT
    neptune: {
        title: 'Contact',
        body: `
            <div class="pi-section">
                <h3>Let's Connect</h3>

                <p>
                    I'm open to software engineering internships,
                    collaborative projects, and opportunities to
                    learn from experienced developers.
                </p>

                <div class="pi-contact-card">
                    <h4>Email</h4>
                    <p>harinisabai@gmail.com</p>

                    <a class="pi-button"
                       href="mailto:harinisabai@gmail.com">
                        Send an Email
                    </a>
                </div>

                <div class="pi-contact-card">
                    <h4>GitHub</h4>
                    <p>github.com/am-harini-k</p>

                    <a class="pi-button"
                       href="https://github.com/am-harini-k"
                       target="_blank"
                       rel="noopener noreferrer">
                        View GitHub Profile
                    </a>
                </div>

                <div class="pi-contact-card">
                    <h4>LinkedIn</h4>
                    <p>www.linkedin.com/in/harini-k06</p>

                    <a class="pi-button"
                       href="https://www.linkedin.com/in/harini-k06"
                       target="_blank"
                       rel="noopener noreferrer">
                        Connect on LinkedIn
                    </a>
                </div>

                <div class="pi-contact-card">
                    <h4>Location</h4>
                    <p>Puducherry, India</p>
                </div>
            </div>
        `
    }

}


// --------------------------------------------------
// CREATE PLANET
// --------------------------------------------------

const segmentsHigh = isLowPower ? 32 : 48
const segmentsLow = isLowPower ? 20 : 32

const createPlanet = (data) => {

    const group =
        new THREE.Group()


    // All planets start aligned along the same axis so the
    // opening view reads as one clean row, like the reference image
    group.rotation.y = 0


    const surfaceTexture =

        data.key === 'earth'

            ? loadTexture('earthDay')

            : loadTexture(data.key)


    const planet =
        new THREE.Mesh(

            new THREE.SphereGeometry(
                data.radius,
                segmentsHigh,
                segmentsLow
            ),

            new THREE.MeshStandardMaterial({

                map: surfaceTexture,

                color:
                    fallbackColors[data.key],

                roughness: .86,

                metalness: .01

            })

        )


    planet.position.x =
        data.orbit


    planet.rotation.z =
        data.tilt


    planet.userData = data


    group.add(planet)


    // --------------------------------------------------
    // SOFT RIM ATMOSPHERE (every planet — closer to the
    // glowing, three-dimensional look of the reference image)
    // --------------------------------------------------

    const rim = new THREE.Mesh(

        new THREE.SphereGeometry(
            data.radius * 1.045,
            segmentsHigh,
            segmentsLow
        ),

        new THREE.MeshBasicMaterial({

            color: data.accent,

            transparent: true,

            opacity: .12,

            blending: THREE.AdditiveBlending,

            side: THREE.BackSide,

            depthWrite: false

        })

    )

    planet.add(rim)


    // --------------------------------------------------
    // EARTH NIGHT LIGHTS
    // --------------------------------------------------

    if (data.key === 'earth') {

        planet.add(
            createEarthNightLayer(
                data.radius
            )
        )

    }


    // --------------------------------------------------
    // VENUS ATMOSPHERE
    // --------------------------------------------------

    if (data.key === 'venus') {

        const atmosphere =

            new THREE.Mesh(

                new THREE.SphereGeometry(
                    data.radius * 1.025,
                    segmentsHigh,
                    segmentsLow
                ),

                new THREE.MeshBasicMaterial({

                    map:
                        loadTexture(
                            'venusAtmosphere'
                        ),

                    color: '#f4c08b',

                    transparent: true,

                    opacity: .16,

                    blending:
                        THREE.AdditiveBlending,

                    depthWrite: false

                })

            )


        planet.add(atmosphere)

    }


    // --------------------------------------------------
    // SATURN RINGS
    // --------------------------------------------------

    if (data.key === 'saturn') {

        const rings =

            new THREE.Mesh(

                // Increased thickness of ring
                new THREE.RingGeometry(
                    1.28,
                    2.45,
                    128
                ),

                new THREE.MeshBasicMaterial({

                    map:
                        loadTexture(
                            'saturnRing'
                        ),

                    color: '#c7b68d',

                    side:
                        THREE.DoubleSide,

                    transparent: true,

                    alphaTest: .04,

                    opacity: .92,

                    depthWrite: false

                })

            )


        rings.rotation.x =
            Math.PI / 2


        planet.add(rings)

    }


    scene.add(group)


    const orbitLine = createOrbit(
        data.orbit
    )


    return {

        data,

        group,

        planet,

        orbitLine

    }
}


// --------------------------------------------------
// ASTEROID BELT
// --------------------------------------------------

const createAsteroidBelt = () => {

    const count = isLowPower ? 500 : 1100


    const asteroids =

        new THREE.InstancedMesh(

            new THREE.DodecahedronGeometry(
                1,
                0
            ),

            new THREE.MeshStandardMaterial({

                color: '#71685d',

                roughness: 1

            }),

            count

        )


    const dummy =
        new THREE.Object3D()


    for (
        let index = 0;
        index < count;
        index++
    ) {

        const angle =
            Math.random() *
            Math.PI *
            2


        const radius =
            11.2 +
            Math.random() *
            1.55


        dummy.position.set(

            Math.cos(angle) *
            radius,

            (Math.random() - .5) *
            .38,

            Math.sin(angle) *
            radius

        )


        dummy.scale.setScalar(

            .025 +
            Math.random() *
            .095

        )


        dummy.rotation.set(

            Math.random() * 3,

            Math.random() * 3,

            Math.random() * 3

        )


        dummy.updateMatrix()


        asteroids.setMatrixAt(
            index,
            dummy.matrix
        )

    }


    scene.add(asteroids)


    return asteroids
}


// --------------------------------------------------
// CREATE SOLAR SYSTEM
// --------------------------------------------------

const createSolarSystem = () => {

    createMilkyWay()
    createStars()


    const sun =
        createSun()


    const planets =
        planetData.map(
            createPlanet
        )


    const asteroidBelt =
        createAsteroidBelt()


    return {

        sun,

        planets,

        asteroidBelt

    }
}


const solarSystem =
    createSolarSystem()


// --------------------------------------------------
// APP STATE MACHINE
// intro -> overview -> warping -> focused -> warping -> overview
// --------------------------------------------------

let appState = 'intro'
let focusedEntry = null

// Simulation clock that can be paused (frozen orbits while
// travelling to / inspecting a planet)
let simTime = 0
let simPaused = true


// --------------------------------------------------
// WARP VISUAL EFFECT (lightweight 2D canvas overlay —
// cheap on the GPU, only runs during a travel transition)
// --------------------------------------------------

const warpCanvas = document.createElement('canvas')
warpCanvas.className = 'solar-warp-canvas'
document.body.appendChild(warpCanvas)

const warpStyle = document.createElement('style')
warpStyle.textContent = `
    .solar-warp-canvas {
        position: fixed;
        inset: 0;
        z-index: 30;
        pointer-events: none;
        opacity: 0;
    }
`
document.head.appendChild(warpStyle)

const warpCtx = warpCanvas.getContext('2d')

const resizeWarpCanvas = () => {
    warpCanvas.width = window.innerWidth
    warpCanvas.height = window.innerHeight
}
resizeWarpCanvas()

let warpAnimationHandle = null

const worldToScreen = (vector3) => {

    const projected = vector3.clone().project(camera)

    return {
        x: (projected.x * .5 + .5) * window.innerWidth,
        y: (-projected.y * .5 + .5) * window.innerHeight
    }
}

const runWarpEffect = (durationMs, vanishPoint) => {

    if(warpAnimationHandle)
    {
        cancelAnimationFrame(warpAnimationHandle)
    }

    const start = performance.now()
    const lines = []
    const lineCount = isLowPower ? 60 : 130

    for(let i = 0; i < lineCount; i++)
    {
        lines.push({
            angle: Math.random() * Math.PI * 2,
            speed: .4 + Math.random() * .9,
            widthJitter: .6 + Math.random() * 1.6,
            delay: Math.random() * .25
        })
    }

    warpCanvas.style.opacity = '1'

    const draw = (now) => {

        const t = Math.min((now - start) / durationMs, 1)

        warpCtx.clearRect(0, 0, warpCanvas.width, warpCanvas.height)

        // Fade the whole burst in, then out
        const envelope = t < .15 ? t / .15 : (t > .75 ? Math.max(0, 1 - ((t - .75) / .25)) : 1)

        lines.forEach((line) => {

            const localT = Math.max(0, Math.min(1, (t - line.delay) / (1 - line.delay)))
            const reach = localT * line.speed * (warpCanvas.width + warpCanvas.height) * .55
            const tailReach = Math.max(0, reach - 60 - line.widthJitter * 40)

            const x1 = vanishPoint.x + Math.cos(line.angle) * tailReach
            const y1 = vanishPoint.y + Math.sin(line.angle) * tailReach
            const x2 = vanishPoint.x + Math.cos(line.angle) * reach
            const y2 = vanishPoint.y + Math.sin(line.angle) * reach

            warpCtx.strokeStyle = `rgba(255, 240, 210, ${.55 * envelope})`
            warpCtx.lineWidth = line.widthJitter
            warpCtx.beginPath()
            warpCtx.moveTo(x1, y1)
            warpCtx.lineTo(x2, y2)
            warpCtx.stroke()

        })

        // Arrival flash
        if(t > .82 && t < .98)
        {
            const flash = 1 - Math.abs((t - .9) / .08)
            warpCtx.fillStyle = `rgba(255, 250, 235, ${Math.max(0, flash) * .28})`
            warpCtx.fillRect(0, 0, warpCanvas.width, warpCanvas.height)
        }

        if(t < 1)
        {
            warpAnimationHandle = requestAnimationFrame(draw)
        }
        else
        {
            warpCtx.clearRect(0, 0, warpCanvas.width, warpCanvas.height)
            warpCanvas.style.opacity = '0'
            warpAnimationHandle = null
        }

    }

    warpAnimationHandle = requestAnimationFrame(draw)
}


// --------------------------------------------------
// INFO PANEL
// --------------------------------------------------

const infoPanelStyle = document.createElement('style')

infoPanelStyle.textContent = `

    .planet-info-panel {
        position: fixed;
        top: 50%;
        right: clamp(16px, 4vw, 60px);
        transform: translate(24px, -50%);
        width: min(
    360px,
    calc(100vw - 32px)
);
        max-height: 74vh;
        overflow-y: auto;
        padding: 30px 30px 34px;
        border-radius: 22px;
        background: linear-gradient(165deg, rgba(14,16,32,.86), rgba(4,5,13,.92));
        border: 1px solid rgba(255,240,194,.18);
        box-shadow: 0 30px 70px rgba(0,0,0,.55), 0 0 40px rgba(59,130,246,.1);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        color: #fff0c2;
        font-family: Georgia, serif;
        opacity: 0;
        pointer-events: none;
        transition: opacity .5s ease, transform .5s ease;
        z-index: 25;
    }

    .planet-info-panel--visible {
        opacity: 1;
        pointer-events: auto;
        transform: translate(0, -50%);
    }

    .planet-info-close {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 1px solid rgba(255,240,194,.3);
        background: rgba(255,255,255,.04);
        color: #fff0c2;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
        transition: background .25s ease, transform .25s ease;
    }

    .planet-info-close:hover {
        background: rgba(59,130,246,.25);
        transform: rotate(90deg);
    }

    .planet-info-chip {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 999px;
        font-size: 10.5px;
        letter-spacing: .12em;
        text-transform: uppercase;
        border: 1px solid currentColor;
        margin-bottom: 14px;
        opacity: .85;
    }

    .planet-info-title {
        margin: 0 0 16px;
        font-size: 28px;
        letter-spacing: .05em;
        text-transform: uppercase;
        background: linear-gradient(90deg, #fff0c2, #3b82f6);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
    }

    .planet-info-placeholder {
        border: 1px dashed rgba(255,240,194,.3);
        border-radius: 14px;
        padding: 18px;
        font-size: 13.5px;
        line-height: 1.7;
        letter-spacing: .02em;
        opacity: .68;
        font-style: italic;
        margin-bottom: 20px;
    }
            /* Add space between paragraphs */
    .planet-info-placeholder p {
        display: block;
        margin-top: 0;
        margin-bottom: 16px;
    }

    /* Add space after headings */
    .planet-info-placeholder h3 {
        display: block;
        margin-top: 20px;
        margin-bottom: 12px;
    }

    .planet-info-placeholder h2 {
        display: block;
        margin-top: 24px;
        margin-bottom: 12px;
    }

        .pi-section {
            display: flex;
            flex-direction: column;
            gap: 14px;
        }

        .pi-section h3,
        .pi-section h4 {
            margin: 0;
            color: #ffffff;
        }

        .pi-section h3 {
            font-size: 1.5rem;
        }

        .pi-section h4 {
            margin-top: 8px;
            color: #a8c7ff;
            letter-spacing: .02em;
        }

        .pi-section p {
            line-height: 1.7;
            margin: 0;
        }

        .pi-sub,
        .pi-note,
        .pi-project-tech {
            color: #a8b2c5;
            font-size: .9rem;
        }

        .pi-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .pi-chip {
            display: inline-flex;
            align-items: center;
            padding: 7px 11px;
            border: 1px solid rgba(125,165,255,.3);
            border-radius: 999px;
            background: rgba(91,125,255,.1);
            color: #dce7ff;
            font: 12px Georgia, serif;
            transition: transform .2s ease, background .2s ease;
        }

        .pi-chip:hover {
            transform: translateY(-2px);
            background: rgba(91,125,255,.24);
        }

        .pi-project,
        .pi-contact-card,
        .pi-award {
            padding: 16px;
            border: 1px solid rgba(148,163,184,.2);
            border-radius: 14px;
            background: rgba(255,255,255,.035);
            transition: transform .2s ease, border-color .2s ease, background .2s ease;
        }

        .pi-project:hover,
        .pi-contact-card:hover,
        .pi-award:hover {
            transform: translateY(-3px);
            border-color: rgba(125,165,255,.48);
            background: rgba(96,125,255,.08);
        }

        .pi-project h4,
        .pi-contact-card h4 {
            color: #ffffff;
        }

        .pi-project-tech {
            margin: 12px 0 !important;
        }

        .pi-action-row {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 8px;
        }

        .pi-button {
            display: inline-flex;
            justify-content: center;
            align-items: center;
            gap: 7px;
            padding: 10px 15px;
            margin-top: 12px;
            border: 1px solid rgba(140,170,255,.45);
            border-radius: 9px;
            background: linear-gradient(135deg, rgba(85,110,255,.95), rgba(113,79,220,.95));
            color: #ffffff !important;
            text-decoration: none !important;
            font: 600 13px Georgia, serif;
            cursor: pointer;
            transition: transform .2s ease, box-shadow .2s ease, filter .2s ease;
        }

        .pi-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 22px rgba(91,110,255,.28);
            filter: brightness(1.12);
        }

        .pi-button:focus-visible,
        .planet-info-close:focus-visible,
        .planet-info-nav button:focus-visible {
            outline: 2px solid #c5d5ff;
            outline-offset: 3px;
        }

        .pi-button-secondary {
            background: rgba(255,255,255,.06);
        }

        .pi-list {
            padding-left: 22px;
            margin: 0;
        }

        .pi-list li {
            margin: 8px 0;
            line-height: 1.6;
        }

        .pi-timeline {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .pi-step {
            position: relative;
            padding: 0 0 4px 20px;
            border-left: 1px solid rgba(125,165,255,.4);
        }

        .pi-dot {
            position: absolute;
            left: -5px;
            top: 4px;
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background: #91aaff;
            box-shadow: 0 0 12px rgba(112,142,255,.5);
        }

    /* Add space around lists */
    .planet-info-placeholder ul {
        margin-top: 8px;
        margin-bottom: 16px;
        padding-left: 20px;
    }

    .planet-info-skeleton {
        height: 10px;
        border-radius: 6px;
        background: rgba(255,240,194,.14);
        margin-bottom: 10px;
    }

    .planet-info-nav {
        display: flex;
        justify-content: space-between;
        margin-top: 22px;
        padding-top: 16px;
    }

    .planet-info-nav button {
        background: none;
        border: none;
        color: #9ec8ff;
        font-family: Georgia, serif;
        font-size: 12px;
        letter-spacing: .1em;
        text-transform: uppercase;
        cursor: pointer;
        opacity: .85;
        transition: opacity .2s ease;
    }

    .planet-info-nav button:hover {
        opacity: 1;
    }

    @media (max-width: 700px) {
        .planet-info-panel {
            right: 50%;
            top: auto;
            bottom: 4vh;
            transform: translate(50%, 24px);
            width: 90vw;
            max-height: 46vh;
        }

        .planet-info-panel--visible {
            transform: translate(50%, 0);
        }
    }

`

document.head.appendChild(infoPanelStyle)

const infoPanel = document.createElement('div')
infoPanel.className = 'planet-info-panel'
infoPanel.setAttribute('role', 'dialog')
infoPanel.setAttribute('aria-modal', 'true')
infoPanel.setAttribute('aria-label', 'Portfolio details')

infoPanel.innerHTML = `
    <button class="planet-info-close" type="button" aria-label="Close portfolio details">&times;</button>
    <span class="planet-info-chip" id="planetInfoChip">Planet</span>
    <h2 class="planet-info-title" id="planetInfoTitle">Planet</h2>
    <div class="planet-info-placeholder" id="planetInfoPlaceholder">
        Placeholder space — personal info coming soon.
    </div>
    
    <div class="planet-info-nav">
        <button type="button" id="planetInfoPrev">&lsaquo; Prev</button>
        <button type="button" id="planetInfoNext">Next &rsaquo;</button>
    </div>
`

document.body.appendChild(infoPanel)

const infoTitleEl = infoPanel.querySelector('#planetInfoTitle')
const infoChipEl = infoPanel.querySelector('#planetInfoChip')
const infoPlaceholderEl = infoPanel.querySelector('#planetInfoPlaceholder')

const showInfoPanel = (entry) => {

    const content = planetInfo[entry.data.key]

    infoTitleEl.textContent = content.title
    infoChipEl.textContent = entry.data.name
    infoChipEl.style.color = entry.data.accent
    infoPlaceholderEl.innerHTML = content.body

    infoPanel.classList.add('planet-info-panel--visible')
}

const hideInfoPanel = () => {
    infoPanel.classList.remove('planet-info-panel--visible')
}

infoPanel.querySelector('.planet-info-close').addEventListener('click', () => {
    returnToOverview()
})

infoPanel.querySelector('#planetInfoPrev').addEventListener('click', () => {
    stepToAdjacentPlanet(-1)
})

infoPanel.querySelector('#planetInfoNext').addEventListener('click', () => {
    stepToAdjacentPlanet(1)
})


// --------------------------------------------------
// CAMERA TRAVEL (generic tween used both ways)
// --------------------------------------------------

let activeTimeline = null

const travelCamera = ({ toPosition, toTarget, duration = 2.1, onArrive }) => {

    appState = 'warping'
    controls.enabled = false

    if(activeTimeline)
    {
        activeTimeline.kill()
    }

    const vanishScreenPoint = worldToScreen(toTarget)
    runWarpEffect(duration * 1000, vanishScreenPoint)

    const fromTarget = lookTarget.clone()
    const proxy = { t: 0 }

    activeTimeline = gsap.timeline({
        onComplete: () => {

            lookTarget.copy(toTarget)

            appState = 'idle-transition'

            onArrive && onArrive()

        }
    })

    activeTimeline.to(camera, {
        fov: WARP_FOV,
        duration: duration * .22,
        ease: 'power2.in',
        onUpdate: () => camera.updateProjectionMatrix()
    }, 0)

    activeTimeline.to(camera.position, {
        x: toPosition.x,
        y: toPosition.y,
        z: toPosition.z,
        duration: duration * .72,
        ease: 'power3.inOut'
    }, duration * .08)

    activeTimeline.to(proxy, {
        t: 1,
        duration: duration * .72,
        ease: 'power3.inOut',
        onUpdate: () => lookTarget.lerpVectors(fromTarget, toTarget, proxy.t)
    }, duration * .08)

    activeTimeline.to(camera, {
        fov: NORMAL_FOV,
        duration: duration * .34,
        ease: 'power2.out',
        onUpdate: () => camera.updateProjectionMatrix()
    }, duration * .58)

}


// --------------------------------------------------
// INTRO CINEMATIC
// --------------------------------------------------

function beginIntro() {

    solarHint.parentElement.classList.add(
        'solar-hud--visible'
    )

    const aspect =
        sizes.width / sizes.height

    const referenceAspect = 1.5

    const zoomOut =
        Math.max(
            1,
            referenceAspect / aspect
        )

    RESPONSIVE_OVERVIEW_POSITION
        .copy(OVERVIEW_TARGET)
        .addScaledVector(
            OVERVIEW_DIRECTION,
            zoomOut
        )

    travelCamera({
        toPosition: RESPONSIVE_OVERVIEW_POSITION,
        toTarget: OVERVIEW_TARGET,
        duration: 3.1,
        onArrive: () => {
            appState = 'overview'
            simPaused = false
            controls.target.copy(OVERVIEW_TARGET)
            controls.minDistance = 6
            controls.maxDistance = 105
            controls.enabled = true
            focusPlanet(solarSystem.planets[0])
        }
    })

}


// --------------------------------------------------
// FOCUS / RETURN LOGIC
// --------------------------------------------------

const getPlanetDestination = (entry) => {

    const worldPos = new THREE.Vector3()
    entry.planet.getWorldPosition(worldPos)

    const frame = entry.data.frame || 1
    const viewDistance = (entry.data.radius * 4.4 + 2.4) * frame

    const offset = new THREE.Vector3(.62, .3, .82)
        .normalize()
        .multiplyScalar(viewDistance)

    return {
        worldPos,
        cameraPos: worldPos.clone().add(offset),
        viewDistance
    }
}

function focusPlanet(entry) {

    if(appState !== 'overview')
    {
        return
    }

    simPaused = true
    focusedEntry = entry
    appState = 'warping'

    hud.classList.remove('solar-hud--visible')

    if(entry.orbitLine)
    {
        gsap.to(entry.orbitLine.material, { opacity: .55, duration: .6 })
    }

    const { worldPos, cameraPos, viewDistance } = getPlanetDestination(entry)

    travelCamera({
        toPosition: cameraPos,
        toTarget: worldPos,
        duration: 2.1,
        onArrive: () => {
            appState = 'focused'
            controls.target.copy(worldPos)
            controls.minDistance = viewDistance * .55
            controls.maxDistance = viewDistance * 1.7
            controls.enabled = true
            showInfoPanel(entry)
        }
    })
}

function returnToOverview() {

    if(appState !== 'focused')
    {
        return
    }

    hideInfoPanel()

    if(focusedEntry && focusedEntry.orbitLine)
    {
        gsap.to(
            focusedEntry.orbitLine.material,
            {
                opacity: .18,
                duration: .6
            }
        )
    }

    const aspect =
        sizes.width / sizes.height

    const referenceAspect = 1.5

    const zoomOut =
        Math.max(
            1,
            referenceAspect / aspect
        )

    RESPONSIVE_OVERVIEW_POSITION
        .copy(OVERVIEW_TARGET)
        .addScaledVector(
            OVERVIEW_DIRECTION,
            zoomOut
        )

    appState = 'warping'

    travelCamera({
        toPosition: RESPONSIVE_OVERVIEW_POSITION,
        toTarget: OVERVIEW_TARGET,
        duration: 2.1,
        onArrive: () => {
            appState = 'overview'
            simPaused = false
            focusedEntry = null
            controls.target.copy(OVERVIEW_TARGET)
            controls.minDistance = 6
            controls.maxDistance = 105
            controls.enabled = true
            hud.classList.add('solar-hud--visible')
        }
    })
}

function stepToAdjacentPlanet(direction) {

    if(appState !== 'focused' || !focusedEntry)
    {
        return
    }

    const currentIndex = solarSystem.planets.indexOf(focusedEntry)
    const nextIndex = (currentIndex + direction + solarSystem.planets.length) % solarSystem.planets.length
    const nextEntry = solarSystem.planets[nextIndex]

    hideInfoPanel()

    if(focusedEntry.orbitLine)
    {
        gsap.to(focusedEntry.orbitLine.material, { opacity: .18, duration: .5 })
    }

    appState = 'warping'

    const { worldPos, cameraPos, viewDistance } = getPlanetDestination(nextEntry)

    if(nextEntry.orbitLine)
    {
        gsap.to(nextEntry.orbitLine.material, { opacity: .55, duration: .6 })
    }

    focusedEntry = nextEntry

    travelCamera({
        toPosition: cameraPos,
        toTarget: worldPos,
        duration: 1.7,
        onArrive: () => {
            appState = 'focused'
            controls.target.copy(worldPos)
            controls.minDistance = viewDistance * .55
            controls.maxDistance = viewDistance * 1.7
            controls.enabled = true
            showInfoPanel(nextEntry)
        }
    })
}


// --------------------------------------------------
// PLANET HOVER + CLICK INTERACTION
// --------------------------------------------------

const raycaster =
    new THREE.Raycaster()


const pointer =
    new THREE.Vector2()


let hoveredPlanet = null

let pointerDownPosition = null


const updatePointer = (event) => {

    const bounds =
        canvas.getBoundingClientRect()


    pointer.x =

        (
            (event.clientX - bounds.left)
            /
            bounds.width
        ) * 2 - 1


    pointer.y =

        -(
            (event.clientY - bounds.top)
            /
            bounds.height
        ) * 2 + 1

}


const getPlanetHit = () => {

    raycaster.setFromCamera(pointer, camera)

    const hit = raycaster.intersectObjects(
        solarSystem.planets.map((item) => item.planet),
        false
    )[0]

    if(!hit)
    {
        return null
    }

    return solarSystem.planets.find((item) => item.planet === hit.object)
}


// --------------------------------------------------
// INTERACTION
// --------------------------------------------------

const setupInteraction = () => {


    canvas.addEventListener(
        'pointermove',
        (event) => {

            updatePointer(event)

            if(appState !== 'overview')
            {
                return
            }

            const entry = getPlanetHit()
            const hit = entry ? entry.planet : null

            // Reset previous planet

            if (
                hoveredPlanet &&
                hoveredPlanet !== hit
            ) {

                hoveredPlanet.scale.setScalar(1)

            }


            hoveredPlanet = hit


            // Cursor

            canvas.style.cursor =
                hoveredPlanet
                    ? 'pointer'
                    : 'grab'


            // Slight hover enlargement

            if (hoveredPlanet) {

                hoveredPlanet.scale.setScalar(
                    1.09
                )

            }

        }
    )


    canvas.addEventListener(
        'pointerdown',
        (event) => {

            canvas.style.cursor =
                'grabbing'

            pointerDownPosition = {
                x: event.clientX,
                y: event.clientY
            }

        }
    )


    canvas.addEventListener(
        'pointerup',
        (event) => {

            canvas.style.cursor =
                hoveredPlanet
                    ? 'pointer'
                    : 'grab'

            if(pointerDownPosition && appState === 'overview')
            {
                const dx = event.clientX - pointerDownPosition.x
                const dy = event.clientY - pointerDownPosition.y
                const dragDistance = Math.sqrt(dx * dx + dy * dy)

                if(dragDistance < 6)
                {
                    updatePointer(event)
                    const entry = getPlanetHit()

                    if(entry)
                    {
                        if(hoveredPlanet)
                        {
                            hoveredPlanet.scale.setScalar(1)
                            hoveredPlanet = null
                        }

                        focusPlanet(entry)
                    }
                }
            }

            pointerDownPosition = null

        }
    )

}


window.addEventListener('keydown', (event) => {

    if(event.key === 'Escape' && appState === 'focused')
    {
        returnToOverview()
    }

})


// --------------------------------------------------
// RESIZE
// --------------------------------------------------

const handleResize = () => {

    sizes.width =
        window.innerWidth

    sizes.height =
        window.innerHeight


    camera.aspect =
        sizes.width /
        sizes.height


    camera.updateProjectionMatrix()


    renderer.setSize(
        sizes.width,
        sizes.height
    )


    renderer.setPixelRatio(
        Math.min(
            window.devicePixelRatio,
            maxPixelRatio
        )
    )


    composer.setSize(
        sizes.width,
        sizes.height
    )

    // EffectComposer.setSize resets every pass to full resolution,
    // so re-apply the lighter bloom resolution on weaker devices
    bloomPass.setSize(
        sizes.width * bloomResolutionScale,
        sizes.height * bloomResolutionScale
    )

    resizeWarpCanvas()
    if(appState === 'overview')
    {
        updateResponsiveOverviewCamera()
    }

}


setupInteraction()


window.addEventListener(
    'resize',
    handleResize
)


// --------------------------------------------------
// PAUSE RENDERING WHEN TAB IS HIDDEN
// (saves GPU/battery and avoids a jarring freeze/catch-up
// effect when the user comes back to the tab)
// --------------------------------------------------

let rafHandle = null
let isTabVisible = true

document.addEventListener('visibilitychange', () => {

    isTabVisible = document.visibilityState === 'visible'

    if(isTabVisible && rafHandle === null && sceneReady)
{
    lastElapsed = clock.getElapsedTime()

    rafHandle = requestAnimationFrame(animate)
}

})


// --------------------------------------------------
// ANIMATION
// --------------------------------------------------

const clock =
    new THREE.Clock()

let lastElapsed = 0


const animate = (now) => {

    if(!isTabVisible)
    {
        rafHandle = null
        return
    }

    if(contextLost)
    {
        rafHandle = requestAnimationFrame(animate)
        return
    }

    const elapsed =
        clock.getElapsedTime()

    const delta = Math.min(elapsed - lastElapsed, .1)
    lastElapsed = elapsed

    if(!simPaused)
    {
        simTime += delta
    }


    // Sun texture rotation

    solarSystem.sun.sun.rotation.y =
        elapsed * .08

    // Sun surface shader flicker/fresnel time uniform
    if(solarSystem.sun.sun.material.userData.shader)
    {
        solarSystem.sun.sun.material.userData.shader.uniforms.uTime.value = elapsed
    }

    // Corona always faces camera (Sprites do this automatically),
    // just give it a very slow breathing pulse for life
    if(solarSystem.sun.coronaGroup)
    {
        const breathe = 1 + Math.sin(elapsed * .35) * .035
        solarSystem.sun.coronaGroup.children.forEach((child) => {

            if(child.userData.baseScale)
            {
                child.scale.set(
                    child.userData.baseScale * breathe,
                    child.userData.baseScale * breathe,
                    1
                )
            }

        })
    }

    // Prominence flares gently flicker in opacity
    if(solarSystem.sun.flares)
    {
        solarSystem.sun.flares.forEach((flare) => {

            const flicker = .55 + .35 * Math.sin(elapsed * .9 + flare.userData.phase)
            flare.material.opacity = flicker

        })
    }


    // Planet movement

    solarSystem.planets.forEach(

        ({
            data,
            group,
            planet
        }) => {

            // Orbit around Sun (paused while travelling / focused)

            group.rotation.y =
                simTime *
                data.speed


            // Planet's own rotation keeps going — subtle sign of life

            planet.rotation.y =
                elapsed *
                data.rotation

        }

    )


    // Asteroid belt rotation

    solarSystem.asteroidBelt.rotation.y =
        simTime * .025


    if(appState === 'overview' || appState === 'focused')
    {
        controls.update()
    }
    else
    {
        // 'intro' and 'warping' — camera is being driven manually
        // (either sitting in the opening shot or mid-travel)
        camera.lookAt(lookTarget)
    }


    composer.render()


    rafHandle = requestAnimationFrame(
        animate
    )

}


rafHandle = requestAnimationFrame(animate)