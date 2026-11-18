import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTableSettingsStore = defineStore(
  'tableSettings',
  () => {
    // { [tableId]: { [colId]: { width?: number, visible?: boolean } } }
    const settings = ref({})

    // { [tableId]: ['col2', 'col1', 'col3'] }
    const order = ref({})

    const getColKey = (col) => col.name || col.field || col.id

    // Сортирует переданный извне массив колонок согласно сохраненному порядку
    const applyOrderToColumns = (tableId, externalColumns = []) => {
      const savedOrder = order.value[tableId] || []
      if (!savedOrder.length) return externalColumns

      return [...externalColumns].sort((a, b) => {
        const indexA = savedOrder.indexOf(getColKey(a))
        const indexB = savedOrder.indexOf(getColKey(b))

        if (indexA === -1 && indexB === -1) return 0
        if (indexA === -1) return 1
        if (indexB === -1) return -1

        return indexA - indexB
      })
    }

    // Перемещает колонку в сохраненном порядке, опираясь на актуальный список колонок извне
    const moveColumn = (tableId, externalColumns, fromIndex, toIndex) => {
      const currentOrderedKeys = applyOrderToColumns(tableId, externalColumns).map(getColKey)

      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= currentOrderedKeys.length ||
        toIndex >= currentOrderedKeys.length ||
        fromIndex === toIndex
      ) {
        return
      }

      const [movedItem] = currentOrderedKeys.splice(fromIndex, 1)
      currentOrderedKeys.splice(toIndex, 0, movedItem)

      order.value = {
        ...order.value,
        [tableId]: currentOrderedKeys
      }
    }

    const getColumnWidth = (tableId, colId) => {
      return settings.value[tableId]?.[colId]?.width || null
    }

    const setColumnWidth = (tableId, colId, width) => {
      settings.value = {
        ...settings.value,
        [tableId]: {
          ...(settings.value[tableId] || {}),
          [colId]: {
            ...(settings.value[tableId]?.[colId] || {}),
            width
          }
        }
      }
    }

    const isColumnVisible = (tableId, colId) => {
      return settings.value[tableId]?.[colId]?.visible ?? true
    }

    const setColumnVisible = (tableId, colId, visible) => {
      settings.value = {
        ...settings.value,
        [tableId]: {
          ...(settings.value[tableId] || {}),
          [colId]: {
            ...(settings.value[tableId]?.[colId] || {}),
            visible
          }
        }
      }
    }

    const resetTableSettings = (tableId) => {
      const updatedSettings = { ...settings.value }
      delete updatedSettings[tableId]
      settings.value = updatedSettings

      const updatedOrder = { ...order.value }
      delete updatedOrder[tableId]
      order.value = updatedOrder
    }

    return {
      settings,
      order,
      applyOrderToColumns,
      moveColumn,
      getColumnWidth,
      setColumnWidth,
      isColumnVisible,
      setColumnVisible,
      resetTableSettings
    }
  },
  {
    persist: true
  }
)
