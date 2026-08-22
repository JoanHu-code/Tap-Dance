<script setup>
const props =
  defineProps({
    batch: {
      type: Object,
      required: true,
    },

    showStudent: {
      type: Boolean,
      default: false,
    },
  })

// ============================================================
// Weekday
// ============================================================

const getWeekdayLabel = (
  weekday
) => {
  const map = {
    1: '星期一',
    2: '星期二',
    3: '星期三',
    4: '星期四',
    5: '星期五',
    6: '星期六',
    7: '星期日',
  }

  return (
    map[
      Number(
        weekday
      )
    ] ||
    ''
  )
}

// ============================================================
// Date
// ============================================================

const formatDate = (
  value
) => {
  return value
    ? String(
        value
      ).slice(
        0,
        10
      )
    : '-'
}

// ============================================================
// DateTime
// ============================================================

const formatDateTime = (
  value
) => {
  if (!value) {
    return '-'
  }

  const date =
    new Date(
      value
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(
      value
    )
  }

  return new Intl
    .DateTimeFormat(
      'zh-TW',
      {
        timeZone:
          'Asia/Taipei',

        year:
          'numeric',

        month:
          '2-digit',

        day:
          '2-digit',

        hour:
          '2-digit',

        minute:
          '2-digit',

        hourCycle:
          'h23',
      }
    )
    .format(
      date
    )
}

// ============================================================
// Time
// ============================================================

const formatTime = (
  value
) => {
  return String(
    value || ''
  ).slice(
    0,
    5
  )
}

// ============================================================
// Item Count
// ============================================================

const itemCount =
  computed(() => {
    return Number(
      props.batch
        ?.item_count ||
      props.batch
        ?.items
        ?.length ||
      0
    )
  })

// ============================================================
// Creator
// ============================================================

const creatorLabel =
  computed(() => {
    const role =
      props.batch
        ?.created_by_role

    if (
      role ===
      'TEACHER'
    ) {
      return '老師'
    }

    if (
      role ===
      'STUDENT'
    ) {
      return '學生'
    }

    return (
      role ||
      '-'
    )
  })
</script>

<template>
  <article
    class="leave-batch-card"
    :class="{
      'leave-batch-card--cancelled':
        batch.status ===
        'CANCELLED',
    }"
  >
    <div class="card-header">
      <div>
        <span class="eyebrow">
          Leave Batch
        </span>

        <h3>
          {{
            batch.course_name
          }}
        </h3>

        <p
          v-if="
            showStudent &&
            batch.student_name
          "
        >
          {{
            batch.student_name
          }}
        </p>
      </div>

      <div class="header-right">
        <span
          class="status-badge"
          :class="{
            'status-badge--cancelled':
              batch.status ===
              'CANCELLED',
          }"
        >
          {{
            batch.status ===
              'ACTIVE'
              ? '有效'
              : '已取消'
          }}
        </span>

        <strong>
          {{
            itemCount
          }}
          堂
        </strong>
      </div>
    </div>

    <div
      v-if="
        batch.reason
      "
      class="reason"
    >
      <span>
        請假原因
      </span>

      <p>
        {{
          batch.reason
        }}
      </p>
    </div>

    <div
      v-if="
        batch.items
          ?.length
      "
      class="item-list"
    >
      <div
        v-for="
          item in
            batch.items
        "
        :key="
          item.id
        "
        class="leave-item"
      >
        <div>
          <strong>
            {{
              formatDate(
                item.class_date
              )
            }}

            <template
              v-if="
                item.weekday
              "
            >
              ・
              {{
                getWeekdayLabel(
                  item.weekday
                )
              }}
            </template>
          </strong>

          <span>
            {{
              formatTime(
                item.start_time
              )
            }}

            <template
              v-if="
                item.end_time
              "
            >
              -
              {{
                formatTime(
                  item.end_time
                )
              }}
            </template>

            <template
              v-if="
                item.schedule_name
              "
            >
              ・
              {{
                item.schedule_name
              }}
            </template>
          </span>
        </div>

        <span
          v-if="
            item.attendance_status
          "
          class="attendance-status"
        >
          {{
            item.attendance_status ===
              'LEAVE'
              ? '請假'
              : item.attendance_status
          }}
        </span>
      </div>
    </div>

    <footer class="card-footer">
      <span>
        建立：
        {{
          creatorLabel
        }}
      </span>

      <span>
        {{
          formatDateTime(
            batch.created_at
          )
        }}
      </span>
    </footer>
  </article>
</template>

<style scoped>
.leave-batch-card {
  padding: 17px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 18px;
}

.leave-batch-card--cancelled {
  opacity: 0.6;
}

.card-header {
  display: flex;
  justify-content: space-between;
  gap: 15px;
}

.eyebrow {
  color: #aaaaaa;
  font-size: 9px;
  letter-spacing: 0.8px;
}

.card-header h3 {
  margin: 4px 0 0;
  font-size: 16px;
}

.card-header p {
  margin: 4px 0 0;
  color: #777777;
  font-size: 10px;
}

.header-right {
  display: flex;
  align-items: flex-end;
  flex-direction: column;
  gap: 7px;
}

.header-right strong {
  font-size: 12px;
}

.status-badge {
  padding: 5px 8px;
  background: #eef8ee;
  border-radius: 999px;
  color: #4b8e50;
  font-size: 9px;
}

.status-badge--cancelled {
  background: #fff0f0;
  color: #c94343;
}

.reason {
  margin-top: 13px;
  padding: 11px;
  background: #f7f7f7;
  border-radius: 11px;
}

.reason span {
  color: #999999;
  font-size: 9px;
}

.reason p {
  margin: 4px 0 0;
  font-size: 10px;
  line-height: 1.6;
}

.item-list {
  margin-top: 12px;
}

.leave-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 48px;
  border-bottom: 1px solid #eeeeee;
}

.leave-item:last-child {
  border-bottom: 0;
}

.leave-item > div {
  display: flex;
  flex-direction: column;
}

.leave-item strong {
  font-size: 10px;
}

.leave-item div span {
  margin-top: 3px;
  color: #888888;
  font-size: 9px;
}

.attendance-status {
  padding: 4px 7px;
  background: #f0f0f0;
  border-radius: 999px;
  color: #666666;
  font-size: 8px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #eeeeee;
  color: #aaaaaa;
  font-size: 9px;
}
</style>