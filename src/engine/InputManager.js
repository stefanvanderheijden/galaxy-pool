/**
 * Attaches to a canvas element and tracks keyboard and mouse state.
 */
export class InputManager {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas
    this.keysPressed = new Set()
    this.mousePosition = { x: 0, y: 0 }
    this.mouseDown = false
    this.dragStart = { x: 0, y: 0 }
    this.dragEnd = { x: 0, y: 0 }
    this.isDragging = false

    this._keyDownCbs = []
    this._keyUpCbs = []
    this._dragCompleteCbs = []

    this._onKeyDown = (e) => {
      this.keysPressed.add(e.key)
      this._keyDownCbs.forEach(cb => cb(e.key, e))
    }
    this._onKeyUp = (e) => {
      this.keysPressed.delete(e.key)
      this._keyUpCbs.forEach(cb => cb(e.key, e))
    }
    this._onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      this.mousePosition.x = (e.clientX - rect.left) * dpr
      this.mousePosition.y = (e.clientY - rect.top) * dpr
    }
    this._onMouseDown = (e) => {
      this.mouseDown = true
      this.isDragging = true
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      this.dragStart = {
        x: (e.clientX - rect.left) * dpr,
        y: (e.clientY - rect.top) * dpr,
      }
    }
    this._onMouseUp = (e) => {
      this.mouseDown = false
      if (this.isDragging) {
        const rect = canvas.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        this.dragEnd = {
          x: (e.clientX - rect.left) * dpr,
          y: (e.clientY - rect.top) * dpr,
        }
        this._dragCompleteCbs.forEach(cb => cb(this.dragStart, this.dragEnd))
      }
      this.isDragging = false
    }

    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
    canvas.addEventListener('mousemove', this._onMouseMove)
    canvas.addEventListener('mousedown', this._onMouseDown)
    canvas.addEventListener('mouseup', this._onMouseUp)
    window.addEventListener('mouseup', this._onMouseUp) // catch releases outside canvas
  }

  /** @param {function(key: string, event: KeyboardEvent): void} cb */
  onKeyDown(cb) { this._keyDownCbs.push(cb) }

  /** @param {function(key: string, event: KeyboardEvent): void} cb */
  onKeyUp(cb) { this._keyUpCbs.push(cb) }

  /** @param {function(start: {x,y}, end: {x,y}): void} cb */
  onDragComplete(cb) { this._dragCompleteCbs.push(cb) }

  /** Remove all event listeners. Call this when tearing down the sketch. */
  destroy() {
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
    this.canvas.removeEventListener('mousemove', this._onMouseMove)
    this.canvas.removeEventListener('mousedown', this._onMouseDown)
    this.canvas.removeEventListener('mouseup', this._onMouseUp)
    window.removeEventListener('mouseup', this._onMouseUp)
  }
}
