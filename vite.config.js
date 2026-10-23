import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import restart from 'vite-plugin-restart'

const projectRoot = dirname(fileURLToPath(import.meta.url))
const solarTextureFiles = [
    '2k_stars_milky_way.jpg', '2k_sun.jpg', '2k_earth_nightmap.jpg', '2k_earth_daymap.jpg',
    '2k_neptune.jpg', '2k_uranus.jpg', '2k_saturn_ring_alpha.png', '2k_saturn.jpg',
    '2k_jupiter.jpg', '2k_mars.jpg', '2k_venus_atmosphere.jpg', '2k_venus_surface.jpg',
    '2k_mercury.jpg'
]

const serveSolarTextures = () => ({
    name: 'serve-solar-textures',
    configureServer(server) {
        server.middlewares.use((request, response, next) => {
            const fileName = request.url?.split('?')[0].slice(1)
            if (!fileName || !fileName.startsWith('2k_')) {
                next()
                return
            }

            const filePath = resolve(projectRoot, 'public', fileName)
            if (!solarTextureFiles.includes(fileName) || !existsSync(filePath)) {
                next()
                return
            }

            const contentTypes = { '.jpg': 'image/jpeg', '.png': 'image/png' }
            response.setHeader('Content-Type', contentTypes[extname(fileName)] || 'application/octet-stream')
            response.end(readFileSync(filePath))
        })
    },
    generateBundle() {
        solarTextureFiles.forEach((fileName) => {
            const filePath = resolve(projectRoot, 'public', fileName)
            if (existsSync(filePath)) {
                this.emitFile({ type: 'asset', fileName, source: readFileSync(filePath) })
            }
        })
    }
})

export default {
    root: 'src/', // Sources files (typically where index.html is)
    publicDir: '../public/', // Path from "root" to static assets (files that are served as they are)
    server:
    {
        host: true, // Open to local network and display URL
        open: !('SANDBOX_URL' in process.env || 'CODESANDBOX_HOST' in process.env) // Open if it's not a CodeSandbox
    },
    build:
{
    rollupOptions:
    {
        input:
        {
            main: resolve(projectRoot, 'src/normal.html'),
            solar: resolve(projectRoot, 'src/solar.html')
        }
    },
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true
},
    plugins:
    [
        serveSolarTextures(),
        restart({ restart: [ '../static/**', ] }) // Restart server on static file change
    ],
}