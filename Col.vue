import { useTableSettingsStore } from 'src/stores/tableSettings'

export const vResize = {
  mounted(th, binding) {
    const tableStore = useTableSettingsStore()
    const { table, col } = binding.value || {}

    // 1. Создаем div-обертку родителем для содержимого th
    const wrapper = document.createElement('div')
    wrapper.className = 'th-resize-wrapper row items-center no-wrap'

    while (th.firstChild) {
      wrapper.appendChild(th.firstChild)
    }

    // 2. Создаем полоску захвата во всю высоту правого края
    const handle = document.createElement('div')
    handle.className = 'col-resizer'
    wrapper.appendChild(handle)
    th.appendChild(wrapper)

    // 3. Вычисляем минимальную ширину один раз при монтировании
    const fixedChild = wrapper.querySelector('.col-auto')
    const minW = fixedChild ? fixedChild.offsetWidth + 40 : 60
    const defaultWidth = 220

    // Жесткая установка ширины для th
    const applyWidth = (px) => {
      const val = px + 'px'
      th.style.setProperty('width', val, 'important')
      th.style.setProperty('min-width', val, 'important')
      th.style.setProperty('max-width', val, 'important')
    }

    // 4. Восстанавливаем сохраненную ширину из Pinia
    const savedWidth = table && col ? tableStore.getColumnWidth(table, col) : null
    const initialWidth = savedWidth ? Math.max(minW, savedWidth) : defaultWidth
    applyWidth(initialWidth)

    // 5. Обработка перетаскивания мышью
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()

      const startX = e.clientX
      const startW = th.offsetWidth
      let currentWidth = startW

      const onMove = (ev) => {
        currentWidth = Math.max(minW, startW + ev.clientX - startX)
        applyWidth(currentWidth)
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''

        if (table && col) {
          tableStore.setColumnWidth(table, col, currentWidth)
        }
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
      document.body.style.cursor = 'col-resize'
    })
  }
}
