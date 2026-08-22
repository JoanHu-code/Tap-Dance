<script setup>
const props = defineProps({
  records: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits([
  'cancel',
])

// ============================================================
// Tab
// ============================================================

const activeTab = ref('ACTIVE')

const activeRecords = computed(() => {
  return props.records.filter(
    (record) =>
      record.status !== 'CANCELLED'
  )
})

const cancelledRecords = computed(() => {
  return props.records.filter(
    (record) =>
      record.status === 'CANCELLED'
  )
})

const displayRecords = computed(() => {
  if (activeTab.value === 'CANCELLED') {
    return cancelledRecords.value
  }

  return activeRecords.value
})

// ============================================================
// 狀態
// ============================================================

const getStatusText = (status) => {
  const statusMap = {
    ATTENDED: '上課',
    LEAVE: '請假',
    CANCELLED: '已取消',
  }

  return statusMap[status] || status
}

const getOriginalStatusText = (status) => {
  const statusMap = {
    ATTENDED: '上課',
    LEAVE: '請假',
  }

  return statusMap[status] || ''
}

const getStatusIcon = (status) => {
  const iconMap = {
    ATTENDED: '✓',
    LEAVE: '💤',
    CANCELLED: '×',
  }

  return iconMap[status] || '•'
}

// ============================================================
// 日期
// ============================================================

const formatDate = (dateString) => {
  return new Intl.DateTimeFormat(
    'zh-TW',
    {
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    }
  ).format(
    new Date(
      `${dateString}T00:00:00`
    )
  )
}
</script>

<template>
  <section class="attendance">
    <div class="attendance__header">
      <h2>
        最近紀錄
      </h2>
    </div>

    <!-- Tab -->
    <div class="attendance-tabs">
      <button
        type="button"
        class="attendance-tab"
        :class="{
          'attendance-tab--active':
            activeTab === 'ACTIVE',
        }"
        @click="activeTab = 'ACTIVE'"
      >
        <span>
          上課紀錄
        </span>

        <span class="attendance-tab__count">
          {{ activeRecords.length }}
        </span>
      </button>

      <button
        type="button"
        class="attendance-tab"
        :class="{
          'attendance-tab--active':
            activeTab === 'CANCELLED',
        }"
        @click="activeTab = 'CANCELLED'"
      >
        <span>
          已取消
        </span>

        <span class="attendance-tab__count">
          {{ cancelledRecords.length }}
        </span>
      </button>
    </div>

    <!-- 紀錄 -->
    <div
      v-if="displayRecords.length"
      class="attendance__list"
    >
      <div
        v-for="record in displayRecords"
        :key="record.id"
        class="attendance-item"
        :class="{
          'attendance-item--cancelled':
            record.status === 'CANCELLED',
        }"
      >
        <div class="attendance-item__status">
          <div
            class="attendance-item__icon"
            :class="{
              'attendance-item__icon--attended':
                record.status === 'ATTENDED',

              'attendance-item__icon--leave':
                record.status === 'LEAVE',

              'attendance-item__icon--cancelled':
                record.status === 'CANCELLED',
            }"
          >
            {{ getStatusIcon(record.status) }}
          </div>

          <div class="attendance-item__info">
            <strong>
              {{ getStatusText(record.status) }}
            </strong>

            <span>
              {{ formatDate(record.date) }}
            </span>

            <small
              v-if="
                record.status === 'CANCELLED' &&
                record.originalStatus
              "
            >
              原紀錄：
              {{
                getOriginalStatusText(
                  record.originalStatus
                )
              }}
            </small>
          </div>
        </div>

        <div class="attendance-item__right">
          <template
            v-if="
              record.status !== 'CANCELLED'
            "
          >
            <span
              v-if="record.confirmed"
              class="confirmed"
            >
              已確認
            </span>

            <span
              v-else
              class="pending"
            >
              待確認
            </span>

            <button
              type="button"
              class="cancel-button"
              @click="
                emit(
                  'cancel',
                  record.id
                )
              "
            >
              取消
            </button>
          </template>

          <span
            v-else
            class="cancelled"
          >
            已取消
          </span>
        </div>
      </div>
    </div>

    <!-- 空資料 -->
    <div
      v-else
      class="attendance__empty"
    >
      <template
        v-if="
          activeTab === 'ACTIVE'
        "
      >
        還沒有上課或請假紀錄
      </template>

      <template v-else>
        目前沒有已取消的紀錄
      </template>
    </div>
  </section>
</template>

<style scoped>
.attendance {
  padding: 22px;
  background: #ffffff;
  border-radius: 24px;
  box-shadow:
    0 8px 30px
    rgb(0 0 0 / 5%);
}

.attendance__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.attendance__header h2 {
  margin: 0;
  font-size: 18px;
}

/* ============================================================
   Tabs
   ============================================================ */

.attendance-tabs {
  display: grid;
  grid-template-columns:
    1fr 1fr;
  gap: 6px;
  margin-top: 18px;
  padding: 5px;
  background: #f5f5f5;
  border-radius: 14px;
}

.attendance-tab {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 8px 12px;
  border: 0;
  background: transparent;
  border-radius: 10px;
  color: #888888;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease;
}

.attendance-tab--active {
  background: #ffffff;
  color: #222222;
  box-shadow:
    0 2px 8px
    rgb(0 0 0 / 6%);
}

.attendance-tab__count {
  display: flex;
  min-width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  background: #eeeeee;
  border-radius: 999px;
  color: #777777;
  font-size: 11px;
}

.attendance-tab--active
.attendance-tab__count {
  background: #222222;
  color: #ffffff;
}

/* ============================================================
   List
   ============================================================ */

.attendance__list {
  margin-top: 10px;
}

.attendance-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 15px 0;
  border-bottom:
    1px solid #eeeeee;
}

.attendance-item:last-child {
  border-bottom: 0;
}

.attendance-item--cancelled {
  opacity: 0.65;
}

.attendance-item__status {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.attendance-item__icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: #f3f3f3;
  border-radius: 14px;
  font-weight: 700;
}

.attendance-item__icon--attended {
  background: #eaf8ee;
  color: #378a4a;
}

.attendance-item__icon--leave {
  background: #fff7e8;
}

.attendance-item__icon--cancelled {
  background: #f1f1f1;
  color: #999999;
}

.attendance-item__info {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.attendance-item__info strong {
  color: #333333;
  font-size: 14px;
}

.attendance-item__info span,
.attendance-item__info small {
  color: #999999;
  font-size: 12px;
}

.attendance-item__right {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
}

.confirmed {
  color: #378a4a;
  font-size: 12px;
}

.pending {
  color: #bf8a29;
  font-size: 12px;
}

.cancelled {
  color: #999999;
  font-size: 12px;
}

.cancel-button {
  padding: 7px 12px;
  border: 0;
  background: #f5f5f5;
  border-radius: 10px;
  color: #777777;
  font-size: 12px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    transform 0.15s ease;
}

.cancel-button:hover {
  background: #eeeeee;
  color: #444444;
}

.cancel-button:active {
  transform:
    scale(0.96);
}

/* ============================================================
   Empty
   ============================================================ */

.attendance__empty {
  padding: 36px 0 24px;
  color: #aaaaaa;
  font-size: 13px;
  text-align: center;
}

@media (
  max-width: 480px
) {
  .attendance-item {
    align-items: flex-start;
  }

  .attendance-item__right {
    flex-direction: column;
    align-items: flex-end;
  }
}
</style>