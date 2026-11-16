import { ref, computed } from 'vue'
import { useTableSettingsStore } from 'src/stores/tableSettings'

const TABLE_ID = 'main_projects_table'
const tableRenderKey = ref(0)
const tableStore = useTableSettingsStore()

// Состояние модального окна и строки поиска
const isColumnsDialogOpen = ref(false)
const columnSearch = ref('')

// Фильтрация списка колонок при вводе в поиск
const filteredColumns = computed(() => {
  const all = tableStore.getTableColumns(TABLE_ID)
  if (!columnSearch.value) return all

  const query = columnSearch.value.toLowerCase().trim()
  return all.filter(col => col.label.toLowerCase().includes(query))
})

// Включить отображение всех колонок разом
const showAllColumns = () => {
  const all = tableStore.getTableColumns(TABLE_ID)
  all.forEach(col => {
    tableStore.setColumnVisible(TABLE_ID, col.name, true)
  })
}
