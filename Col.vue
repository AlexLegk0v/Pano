<template>
  <q-dialog
    :model-value="modelValue"
    seamless
    @update:model-value="$emit('update:modelValue', $event)"
    @before-show="resetDialogPosition"
  >
    <!-- Ссылка ref="dialogCardRef" нужна для расчета габаритов окна -->
    <q-card
      ref="dialogCardRef"
      class="shadow-10"
      style="min-width: 400px; max-width: 90vw; border: 1px solid #e0e0e0;"
      :style="dialogStyle"
    >
      <!-- Шапка диалога для перетаскивания -->
      <q-card-section
        v-touch-pan.prevent.mouse="onDragDialog"
        class="row items-center q-pb-none cursor-move select-none"
      >
        <div class="text-h6">Настройка колонок</div>
        <q-space />
        <q-btn
          icon="close"
          flat
          round
          dense
          v-close-popup
          @mousedown.stop
        />
      </q-card-section>

      <!-- Поиск -->
      <q-card-section class="q-pb-sm">
        <q-input
          v-model="columnSearch"
          placeholder="Поиск колонки..."
          dense
          outlined
          clearable
        >
          <template #prepend>
            <q-icon name="search" />
          </template>
        </q-input>
      </q-card-section>

      <!-- Список колонок с Drag-and-Drop и стрелками -->
      <q-card-section style="max-height: 55vh" class="scroll q-pt-none">
        <q-list dense bordered separator class="rounded-borders">
          <q-item
            v-for="(col, index) in filteredColumns"
            :key="getColKey(col)"
            :draggable="!columnSearch"
            :class="[
              'column-item',
              { 'drag-over-item': dragOverIndex === index }
            ]"
            @dragstart="onDragStart($event, index)"
            @dragover.prevent="onDragOver(index)"
            @dragleave="onDragLeave"
            @drop="onDrop($event, index)"
            @dragend="onDragEnd"
          >
            <q-item-section side v-if="!columnSearch" class="q-pr-xs cursor-grab">
              <q-icon name="drag_indicator" color="grey-6" size="20px" />
            </q-item-section>

            <q-item-section side class="q-pr-sm">
              <q-checkbox
                dense
                :model-value="tableStore.isColumnVisible(tableId, getColKey(col))"
                @update:model-value="tableStore.setColumnVisible(tableId, getColKey(col), $event)"
              />
            </q-item-section>

            <q-item-section>
              <q-item-label class="ellipsis">{{ col.label }}</q-item-label>
            </q-item-section>

            <q-item-section side v-if="!columnSearch">
              <div class="row items-center no-wrap">
                <q-btn
                  icon="keyboard_arrow_up"
                  flat
                  round
                  dense
                  size="sm"
                  color="grey-8"
                  :disable="index === 0"
                  @click.stop="moveCol(index, index - 1)"
                />
                <q-btn
                  icon="keyboard_arrow_down"
                  flat
                  round
                  dense
                  size="sm"
                  color="grey-8"
                  :disable="index === filteredColumns.length - 1"
                  @click.stop="moveCol(index, index + 1)"
                />
              </div>
            </q-item-section>
          </q-item>

          <div v-if="filteredColumns.length === 0" class="text-grey text-center q-pa-md">
            Колонки не найдены
          </div>
        </q-list>

        <div v-if="columnSearch" class="text-caption text-grey-6 q-mt-xs">
          Очистите поиск, чтобы менять порядок колонок
        </div>
      </q-card-section>

      <q-separator />

      <!-- Нижняя панель действий -->
      <q-card-actions align="between" class="q-px-md">
        <div class="row items-center q-gutter-xs">
          <q-btn
            label="Показать все"
            flat
            size="sm"
            color="primary"
            @click="showAllColumns"
          />
          <q-btn
            label="Сбросить"
            flat
            size="sm"
            color="negative"
            @click="handleReset"
          />
        </div>

        <q-btn
          label="Готово"
          unelevated
          size="sm"
          color="primary"
          v-close-popup
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useTableSettingsStore } from 'src/stores/tableSettings'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  tableId: {
    type: String,
    required: true
  },
  columns: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue', 'reset'])

const $q = useQuasar()
const tableStore = useTableSettingsStore()
const columnSearch = ref('')
const draggedIndex = ref(null)
const dragOverIndex = ref(null)

// --- Логика перетаскивания диалога с ограничением границ ---
const dialogCardRef = ref(null)
const dialogPos = ref({ x: 0, y: 0 })

const dialogStyle = computed(() => ({
  transform: `translate(${dialogPos.value.x}px, ${dialogPos.value.y}px)`
}))

const onDragDialog = (evt) => {
  let nextX = dialogPos.value.x + evt.delta.x
  let nextY = dialogPos.value.y + evt.delta.y

  const cardEl = dialogCardRef.value?.$el
  if (cardEl) {
    // Так как диалог изначально центрирован во вьюпорте,
    // максимальный сдвиг от центра до края экрана равен половине разницы размеров
    const maxOffsetX = Math.max(0, (window.innerWidth - cardEl.offsetWidth) / 2)
    const maxOffsetY = Math.max(0, (window.innerHeight - cardEl.offsetHeight) / 2)

    nextX = Math.min(Math.max(nextX, -maxOffsetX), maxOffsetX)
    nextY = Math.min(Math.max(nextY, -maxOffsetY), maxOffsetY)
  }

  dialogPos.value = { x: nextX, y: nextY }
}

const resetDialogPosition = () => {
  dialogPos.value = { x: 0, y: 0 }
}

// --- Логика колонок ---
const getColKey = (col) => col.name || col.field || col.id

const orderedColumns = computed(() => {
  return tableStore.applyOrderToColumns(props.tableId, props.columns)
})

const filteredColumns = computed(() => {
  if (!columnSearch.value) return orderedColumns.value

  const query = columnSearch.value.toLowerCase().trim()
  return orderedColumns.value.filter(col => col.label.toLowerCase().includes(query))
})

const moveCol = (fromIndex, toIndex) => {
  tableStore.moveColumn(props.tableId, props.columns, fromIndex, toIndex)
}

const onDragStart = (event, index) => {
  draggedIndex.value = index
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', index.toString())
}

const onDragOver = (index) => {
  if (draggedIndex.value === null || draggedIndex.value === index) return
  dragOverIndex.value = index
}

const onDragLeave = () => {
  dragOverIndex.value = null
}

const onDrop = (event, targetIndex) => {
  event.preventDefault()
  if (draggedIndex.value !== null && draggedIndex.value !== targetIndex) {
    moveCol(draggedIndex.value, targetIndex)
  }
  draggedIndex.value = null
  dragOverIndex.value = null
}

const onDragEnd = () => {
  draggedIndex.value = null
  dragOverIndex.value = null
}

const showAllColumns = () => {
  props.columns.forEach(col => {
    tableStore.setColumnVisible(props.tableId, getColKey(col), true)
  })
}

const handleReset = () => {
  tableStore.resetTableSettings(props.tableId)
  emit('reset')

  $q.notify({
    type: 'positive',
    message: 'Настройки колонок сброшены к исходным',
    position: 'bottom-right',
    timeout: 2000
  })
}
</script>

<style scoped>
.cursor-move {
  cursor: move;
}

.column-item {
  transition: background-color 0.15s ease;
}

.cursor-grab {
  cursor: grab;
}

.cursor-grab:active {
  cursor: grabbing;
}

.drag-over-item {
  border-top: 2px solid var(--q-primary) !important;
  background-color: rgba(25, 118, 210, 0.08);
}
</style>
