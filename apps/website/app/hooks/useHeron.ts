
/**
 * This component is a fun little easter egg. Whene added to a page a curius
 * heron will come to visit inactive users :)
 *
 * TODO:
 * - Handle heron death
 * - Write the heron trigger code
 */

import heronImage from "@assets/heron.png"
import probeImage from "@assets/probe.png"

declare global {
  interface Window {
    heron: Heron
  }
}

const SMOOTHNESS = 0.5

export function useHeron() {
  if (
    typeof window != "undefined" && 
    window.document &&
    window.document.body &&
    window.innerWidth > 700 &&
    window.heron == undefined
  ) {
    window.heron = new Heron(window.document)
  } else {
    return
  }

  window.heron.bind(document.body)
  animateProbing1(window.heron, window, window.document.body)
}

class Heron {
  private el: HTMLImageElement
  private probes: HTMLImageElement[]

  constructor(document: Document) {
    this.el = document.createElement("img")
    this.el.src = heronImage
    this.el.width = 64
    this.el.height = 64
    this.el.style.position = "fixed"
    this.el.style.zIndex = "1000000"
    this.el.style.display = "none"
    this.el.style.top = "-32px"
    this.el.style.left = "-32px"
    this.el.style.transition = `transform 0`

    this.probes = []
    for (let i = 0; i < 7; i++) {
      this.probes.push(document.createElement("img"))
      this.probes[i].src = probeImage
      this.probes[i].width = 16
      this.probes[i].height = 16
      this.probes[i].style.position = "fixed"
      this.probes[i].style.zIndex = "1000000"
      this.probes[i].style.display = "none"
      this.probes[i].style.top = "-8px"
      this.probes[i].style.left = "-8px"
      this.probes[i].style.transition = `transform 0`
    }
  }

  bind(bindEl: HTMLElement) {
    bindEl.appendChild(this.el)
    for (const probe of this.probes) {
      bindEl.appendChild(probe)
    }
  }

  move(x: number, y: number, duration: number) {
    this.el.style.transitionDuration = `${duration}s`
    this.el.style.transitionTimingFunction = `cubic-bezier(${.42/duration*SMOOTHNESS},0,${.58/duration*SMOOTHNESS},1)`
    this.el.offsetWidth  // trigger a reflow to apply the transition propoerty
    this.el.style.transform = `translate(${x}px, ${y}px)`
    return new Promise((res) => {
      setTimeout(() => requestAnimationFrame(res), duration*1000)
    })
  }

  moveProbe(x: number, y: number, index: number) {
    this.probes[index].style.transform = `translate(${x}px, ${y}px)`
  }

  show() {
    this.el.style.display = "block"
  }
  hide() {
    this.el.style.display = "none"
  }

  showProbs() {
    for (const probe of this.probes) {
      probe.style.display = "block"
      probe.style.transitionDuration = ".1s"
    }
  }
  hideProbs() {
    for (const probe of this.probes) {
      probe.style.display = "none"
      probe.style.transitionDuration = "0"
    }
  }
}

async function animateEavesdrop1(heron: Heron, window: Window, body: HTMLElement) {
  const ww = window.innerWidth
  const winHeight = window.innerHeight
  let canceled = false

  function cancel () {
    canceled = true
    heron.move(ww+32, 0.7*winHeight, 0.5)
  }
  body.addEventListener("mousemove", cancel)

  heron.show()
  await heron.move(ww+32, 0.7*winHeight, 0)
    .then(() => !canceled && heron.move(ww-10, 0.7*winHeight, 2))
    .then(() => !canceled && sleep(3))
    .then(() => !canceled && heron.move(ww+32, 0.7*winHeight, 2))
    .then(() => !canceled && heron.hide())

  body.removeEventListener("mousemove", cancel)
}

async function animateEavesdrop2(heron: Heron, window: Window, body: HTMLElement) {
  const ww = window.innerWidth
  const winHeight = window.innerHeight
  let canceled = false

  function cancel () {
    canceled = true
    heron.move(-32, 0.3*winHeight, 0.5)
  }
  body.addEventListener("mousemove", cancel)

  heron.show()
  await heron.move(-32, 0.3*winHeight, 0)
    .then(() => !canceled && heron.move(10, 0.3*winHeight, 2))
    .then(() => !canceled && sleep(3))
    .then(() => !canceled && heron.move(-32, 0.3*winHeight, 2))
    .then(() => !canceled && heron.hide())

  body.removeEventListener("mousemove", cancel)
}

async function animateEavesdrop3(heron: Heron, window: Window, body: HTMLElement) {
  const ww = window.innerWidth
  const wh = window.innerHeight
  let canceled = false

  function cancel () {
    canceled = true
    heron.move(0.4*ww, wh+32, 0.5)
  }
  body.addEventListener("mousemove", cancel)

  heron.show()
  await heron.move(0.4*ww, wh+32, 0)
    .then(() => !canceled && heron.move(0.4*ww, wh-20, 2.5))
    .then(() => !canceled && sleep(3))
    .then(() => !canceled && heron.move(0.4*ww, wh+32, 2.5))
    .then(() => !canceled && heron.hide())

  body.removeEventListener("mousemove", cancel)
}

async function animateProbing1(heron: Heron, window: Window, body: HTMLElement) {
  const ww = window.innerWidth
  const wh = window.innerHeight
  let canceled = false

  function cancel () {
    canceled = true
    sleep(0.5)
      .then(() => scoopProbs())
      .then(() => heron.move(0.65*ww, -64, 0.5))
  }
  body.addEventListener("mousemove", cancel)

  function dropProbes(x: number, y: number) {
    for (let i = 0; i < 7; i++) {
      const dx = 45*Math.cos(2*Math.PI/7*i) + 20*(Math.random() - .5)
      const dy = 45*Math.sin(2*Math.PI/7*i) + 20*(Math.random() - .5)
      heron.moveProbe(x+dx, y+dy, i)
    }
    heron.showProbs()
    return Promise.resolve(null)
  }

  function scoopProbs() {
    heron.hideProbs()
    return Promise.resolve(null)
  }

  function scan() {
    for (let i = 0; i < 7; i++) {
      const x = ww*Math.random()
      const y = wh*Math.random()
      heron.moveProbe(x, y, i)
    }
    return Promise.resolve(null)
  }

  heron.show()
  await heron.move(0.8*ww, -32, 0)
    .then(() => !canceled && heron.move(0.75*ww, 70, 2))
    .then(() => !canceled && sleep(1))
    .then(() => !canceled && heron.move(0.7*ww, 120, 3))
    .then(() => !canceled && sleep(1))
    .then(() => !canceled && dropProbes(0.7*ww, 120))
    .then(() => !canceled && sleep(2))
    .then(() => !canceled && scan())
    .then(() => !canceled && sleep(20))
    .then(() => !canceled && scan())
    .then(() => !canceled && sleep(20))
    .then(() => !canceled && scan())
    .then(() => !canceled && sleep(20))
    .then(() => !canceled && scan())
    .then(() => !canceled && sleep(20))
    .then(() => !canceled && scoopProbs())
    .then(() => !canceled && sleep(1))
    .then(() => !canceled && heron.move(0.65*ww, -64, 3))
    .then(() => !canceled && heron.hide())

  body.removeEventListener("mousemove", cancel)
}

function sleep(sec: number) {
  return new Promise((res) => setTimeout(res, sec*1000))
}
