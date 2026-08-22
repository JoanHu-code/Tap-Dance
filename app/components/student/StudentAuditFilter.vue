<script setup>
// ============================================================
// Props
// ============================================================

const props =
  defineProps({
    modelValue: {
      type: Object,
      required: true,
    },

    actions: {
      type: Array,
      default: () => [],
    },

    entityTypes: {
      type: Array,
      default: () => [],
    },

    loading: {
      type: Boolean,
      default: false,
    },
  })

// ============================================================
// Emits
// ============================================================

const emit =
  defineEmits([
    'update:modelValue',
    'search',
    'reset',
  ])

// ============================================================
// Local Model
// ============================================================

const form =
  reactive({
    keyword: '',
    action: '',
    entityType: '',
    startDate: '',
    endDate: '',
  })

// ============================================================
// Sync From Parent
// ============================================================

const syncFromParent =
  () => {
    form.keyword =
      props.modelValue
        ?.keyword ||
      ''

    form.action =
      props.modelValue
        ?.action ||
      ''

    form.entityType =
      props.modelValue
        ?.entityType ||
      ''

    form.startDate =
      props.modelValue
        ?.startDate ||
      ''

    form.endDate =
      props.modelValue
        ?.endDate ||
      ''
  }

// ============================================================
// Emit Model
// ============================================================

const emitModel =
  () => {
    emit(
      'update:modelValue',
      {
        keyword:
          form.keyword,

        action:
          form.action,

        entityType:
          form.entityType,

        startDate:
          form.startDate,

        endDate:
          form.endDate,
      }
    )
  }

// ============================================================
// Labels
// ============================================================

const getActionLabel = (
  value
) => {
  const map = {
    CREATE:
      '新增',

    UPDATE:
      '修改',

    CANCEL:
      '取消',

    RESTORE:
      '恢復',

    RENEW:
      '續期',

    LINK:
      '綁定',

    UNLINK:
      '解除綁定',
  }

  return (
    map[value] ||
    value
  )
}

const getEntityLabel = (
  value
) => {
  const map = {
    ATTENDANCE:
      '出席紀錄',

    LEAVE:
      '請假',

    MAKEUP:
      '補課',

    SESSION:
      '課堂',

    PACKAGE:
      '堂數方案',

    ENROLLMENT:
      '選課',

    STUDENT:
      '學生資料',

    USER:
      '帳號',

    SCHEDULE:
      '固定時段',
  }

  return (
    map[value] ||
    value
  )
}

// ============================================================
// Search
// ============================================================

const search =
  () => {
    emitModel()

    emit(
      'search'
    )
  }

// ============================================================
// Reset
// ============================================================

const reset =
  () => {
    form.keyword =
      ''

    form.action =
      ''

    form.entityType =
      ''

    form.startDate =
      ''

    form.endDate =
      ''

    emitModel()

    emit(
      'reset'
    )
  }

// ============================================================
// Watch
// ============================================================

watch(
  () =>
    props.modelValue,
  () => {
    syncFromParent()
  },
  {
    deep: true,
    immediate: true,
  }
)
</script>

<template>
  <section class="audit-filter">
    <!-- ======================================================
         Keyword
         ====================================================== -->

    <label class="keyword-field">
      <span>
        搜尋紀錄
      </span>

      <input
        v-model="
          form.keyword
        "
        type="search"
        placeholder="搜尋備註、課程、Action..."
        :disabled="
          loading
        "
        @keyup.enter="
          search
        "
      >
    </label>

    <!-- ======================================================
         Action
         ====================================================== -->

    <label>
      <span>
        操作
      </span>

      <select
        v-model="
          form.action
        "
        :disabled="
          loading
        "
      >
        <option value="">
          全部操作
        </option>

        <option
          v-for="
            item in actions
          "
          :key="
            item
          "
          :value="
            item
          "
        >
          {{
            getActionLabel(
              item
            )
          }}
        </option>
      </select>
    </label>

    <!-- ======================================================
         Entity
         ====================================================== -->

    <label>
      <span>
        紀錄類型
      </span>

      <select
        v-model="
          form.entityType
        "
        :disabled="
          loading
        "
      >
        <option value="">
          全部類型
        </option>

        <option
          v-for="
            item in
              entityTypes
          "
          :key="
            item
          "
          :value="
            item
          "
        >
          {{
            getEntityLabel(
              item
            )
          }}
        </option>
      </select>
    </label>

    <!-- ======================================================
         Start Date
         ====================================================== -->

    <label>
      <span>
        開始日期
      </span>

      <input
        v-model="
          form.startDate
        "
        type="date"
        :disabled="
          loading
        "
      >
    </label>

    <!-- ======================================================
         End Date
         ====================================================== -->

    <label>
      <span>
        結束日期
      </span>

      <input
        v-model="
          form.endDate
        "
        type="date"
        :disabled="
          loading
        "
      >
    </label>

    <!-- ======================================================
         Actions
         ====================================================== -->

    <div class="actions">
      <button
        type="button"
        :disabled="
          loading
        "
        @click="
          reset
        "
      >
        清除
      </button>

      <button
        type="button"
        class="search-button"
        :disabled="
          loading
        "
        @click="
          search
        "
      >
        {{
          loading
            ? '查詢中...'
            : '查詢'
        }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.audit-filter {
  display: grid;
  grid-template-columns:
    1fr
    1fr;
  gap: 9px;
  padding: 14px;
  background: #ffffff;
  border-radius: 17px;
}

.audit-filter label {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.audit-filter label > span {
  color: #888888;
  font-size: 9px;
}

.keyword-field {
  grid-column:
    1 /
    -1;
}

.audit-filter input,
.audit-filter select {
  width: 100%;
  min-height: 40px;
  padding:
    0
    9px;
  border: 1px solid #dddddd;
  background: #ffffff;
  border-radius: 9px;
  color: #333333;
  font-size: 10px;
}

.audit-filter input:focus,
.audit-filter select:focus {
  border-color: #888888;
  outline: none;
}

.actions {
  grid-column:
    1 /
    -1;
  display: flex;
  justify-content: flex-end;
  gap: 7px;
  margin-top: 2px;
}

.actions button {
  min-height: 35px;
  padding:
    0
    13px;
  border: 0;
  background: #eeeeee;
  border-radius: 9px;
  color: #555555;
  font-size: 9px;
}

.actions .search-button {
  background: #222222;
  color: #ffffff;
}

.actions button:disabled,
.audit-filter input:disabled,
.audit-filter select:disabled {
  opacity: 0.5;
}

@media (
  max-width: 420px
) {
  .audit-filter {
    grid-template-columns:
      1fr;
  }

  .keyword-field,
  .actions {
    grid-column:
      auto;
  }
}
</style>