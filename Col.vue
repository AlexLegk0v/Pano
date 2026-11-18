<template>
  <div class="q-pa-md">
    <!-- Верхняя панель управления (осталась только кнопка открытия настроек) -->
    <div class="row items-center q-gutter-md q-mb-sm">
      <q-btn
        label="Настройка колонок"
        icon="view_column"
        size="sm"
        outline
        color="primary"
        @click="isColumnsDialogOpen = true"
      />
    </div>

    <!-- Модальное окно с подпиской на событие @reset -->
    <ColumnsSettingsDialog
      v-model="isColumnsDialogOpen"
      :table-id="tableId"
      :columns="activeColumns"
      @reset="tableRenderKey++"
    />

    <!-- Таблица -->
    <q-table
      :key="tableRenderKey"
      :rows="rows"
      :columns="orderedColumns"
      :visible-columns="visibleColumnNames"
      row-key="id"
      separator="vertical"
      table-class="resizable-q-table"
      table-style="table-layout: fixed; width: max-content; min-width: 100%"
    >
      <template #header="props">
        <tr :props="props">
          <th
            v-for="col in props.cols"
            :key="col.name"
            v-resize="{ table: tableId, col: col.name }"
          >
            <div class="col ellipsis">{{ col.label }}</div>
            <div v-if="col.sortable" class="col-auto q-ml-sm">🔽</div>
          </th>
        </tr>
      </template>

      <template #body="props">
        <tr :props="props">
          <td
            v-for="col in props.cols"
            :key="col.name"
          >
            {{ props.row[col.field || col.name] }}
          </td>
        </tr>
      </template>
    </q-table>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useTableSettingsStore } from 'src/stores/tableSettings'
import { vResize } from 'src/directives/vResize'
import ColumnsSettingsDialog from 'src/components/ColumnsSettingsDialog.vue'

const props = defineProps({
  tableId: {
    type: String,
    default: 'universal_dynamic_table'
  },
  columns: {
    type: Array,
    default: () => []
  }
})

const tableRenderKey = ref(0)
const tableStore = useTableSettingsStore()

const activeColumns = ref([])
const rows = ref([])
const currentFilters = ref({})
const isColumnsDialogOpen = ref(false)

const normalizeColumns = (cols) => {
  return (cols || []).map(col => ({
    ...col,
    name: col.name || col.field || col.id
  }))
}

watch(
  () => props.columns,
  (newCols) => {
    activeColumns.value = normalizeColumns(newCols)
    tableRenderKey.value++
  },
  { immediate: true }
)

const orderedColumns = computed(() => {
  return tableStore.applyOrderToColumns(props.tableId, activeColumns.value)
})

const visibleColumnNames = computed(() => {
  return orderedColumns.value
    .filter(col => tableStore.isColumnVisible(props.tableId, col.name))
    .map(col => col.name)
})

const refresh = (newColumns, newRows, newFilters = {}) => {
  activeColumns.value = normalizeColumns(newColumns)
  rows.value = newRows || []
  currentFilters.value = newFilters
  tableRenderKey.value++
}

defineExpose({ refresh })
</script>

<style scoped>
:deep(.resizable-q-table th) {
  padding: 0;
  overflow: hidden;
}

:deep(.th-resize-wrapper) {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 8px 16px;
  user-select: none;
}

:deep(.th-resize-wrapper .col) {
  min-width: 0;
}

:deep(.th-resize-wrapper .col-auto) {
  flex-shrink: 0;
  white-space: nowrap;
}

:deep(.col-resizer) {
  position: absolute;
  top: 0;
  right: 0;
  width: 6px;
  height: 100%;
  cursor: col-resize;
}

:deep(.col-resizer:hover) {
  background-color: var(--q-primary);
}

:deep(.resizable-q-table td) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
