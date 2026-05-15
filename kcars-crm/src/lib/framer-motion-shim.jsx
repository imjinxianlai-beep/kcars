import React from 'react'

const motionProps = new Set([
  'animate',
  'exit',
  'initial',
  'layout',
  'layoutId',
  'transition',
  'variants',
  'viewport',
  'whileFocus',
  'whileHover',
  'whileInView',
  'whileTap',
])

function stripMotionProps(props) {
  const next = {}
  for (const [key, value] of Object.entries(props)) {
    if (!motionProps.has(key)) next[key] = value
  }
  return next
}

function createMotionElement(tag) {
  return React.forwardRef(function MotionElement(props, ref) {
    return React.createElement(tag, { ...stripMotionProps(props), ref })
  })
}

export const motion = new Proxy({}, {
  get(target, tag) {
    if (!target[tag]) target[tag] = createMotionElement(tag)
    return target[tag]
  },
})

export function AnimatePresence({ children }) {
  return <>{children}</>
}
