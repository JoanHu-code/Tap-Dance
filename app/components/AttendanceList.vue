<script setup>
defineProps({
  records: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits([
  'cancel',
])

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
      <h2>最近紀錄</h2>

      <span>
        {{ records.length }} 筆
      </span>
    </div>

    <div
      v-if="records.length"
      class="attendance__list"
    >
      <div
        v-for="record in records"
        :key="record.id"
        class="attendance-item"
        :class="{
          'attendance-item--cancelled':
            record.status === 'CANCELLED',
        }"
      >
        <div class="attendance-item__status">
          <div class="attendance-item__icon">
            {{ getStatusIcon(record.status) }}
          </div>

          <div>
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
            v-if="record.status !== 'CANCELLED'"
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
              class="cancel-button"
              @click="emit('cancel', record.id)"
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

    <div
      v-else
      class="attendance__empty"
    >
      還沒有任何上課紀錄
    </div>
  </section>
</template>

<style scoped>
.attendance {
  padding: 22px;
  background: #ffffff;
  border-radius: 24px;
  box-shadow: 0 8px 30px rgb(0 0 0 / 5%);
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

.attendance__header > span {
  color: #999999;
  font-size: 13px;
}

.attendance__list {
  margin-top: 14px;
}

.attendance-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 15px 0;
  border-bottom: 1px solid #eeeeee;
}

.attendance-item:last-child {
  border-bottom: 0;
}

.attendance-item--cancelled {
  opacity: 0.55;
}

.attendance-item__status {
  display: flex;
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
}

.attendance-item__status > div:last-child {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.attendance-item__status span,
.attendance-item__status small {
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
}

.attendance__empty {
  padding: 32px 0;
  color: #aaaaaa;
  text-align: center;
}
</style>