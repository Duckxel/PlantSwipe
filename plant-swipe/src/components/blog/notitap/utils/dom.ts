export const stopPrevent = <T extends Event>(event: T): T => {
  event.stopPropagation()
  event.preventDefault()
  return event
}

