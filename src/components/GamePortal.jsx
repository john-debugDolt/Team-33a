import { createPortal } from 'react-dom'

export default function GamePortal({ children }) {
  return createPortal(children, document.body)
}
