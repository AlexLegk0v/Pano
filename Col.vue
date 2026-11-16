<template>
  <div class="q-pa-md">
    <!-- Панель над таблицей -->
    <div class="row items-center q-gutter-md q-mb-sm">
      <q-btn
        label="Настройка колонок"
        icon="view_column"
        size="sm"
        outline
        color="primary"
        @click="isColumnsDialogOpen = true"
      />

      <q-btn
        label="Сбросить настройки"
        size="sm"
        flat
        color="grey-7"
        @click="handleReset"
      />
    </div>

    <!-- Модальное окно выбора колонок -->
    <q-dialog v-model="isColumnsDialogOpen">
      <q-card style="min-width: 350px; max-width: 90vw;">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Отображаемые колонки</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <!-- Поле поиска по колонкам (удобно, если их много) -->
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

        <!-- Список колонок с прокруткой -->
        <q-card-section style="max-height: 50vh" class="scroll q-pt-none">
          <q-list dense>
            <q-item
              v-for="col in filteredColumns"
              :key="col.name"
              tag="label"
              clickable
            >
              <q-item-section side>
                <q-checkbox
                  :model-value="tableStore.isColumnVisible(TABLE_ID, col.name)"
                  @update:model-value="tableStore.setColumnVisible(TABLE_ID, col.name, $event)"
                />
              </q-item-section>
              <q-item-section>{{ col.label }}</q-item-section>
            </q-item>

            <div v-if="filteredColumns.length === 0" class="text-grey text-center q-pa-md">
              Колонки не найдены
            </div>
          </q-list>
        </q-card-section>

        <q-separator />

        <!-- Нижняя панель действий -->
        <q-card-actions align="between" class="q-px-md">
          <q-btn
            label="Показать все"
            flat
            size="sm"
            color="primary"
            @click="showAllColumns"
          />
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

    <!-- Ваша таблица остается без изменений -->
    <q-table
      :key="tableRenderKey"
      :rows="rows"
      row-key="id"
      separator="vertical"
      table-class="resizable-q-table"
      table-style="table-layout: fixed; width: max-content; min-width: 100%"
    >
      <!-- ... слоты #header и #body ... -->
    </q-table>
  </div>
</template>
