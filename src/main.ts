import * as THREE from 'three'
import './style.css'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('Application root element was not found.')
}

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
camera.position.z = 5

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setClearColor(0xffffff, 0)
app.append(renderer.domElement)

function resize() {
  const width = window.innerWidth
  const height = window.innerHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

window.addEventListener('resize', resize)
renderer.setAnimationLoop(() => renderer.render(scene, camera))
