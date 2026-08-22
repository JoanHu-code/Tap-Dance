<script setup>
const props =
  defineProps({
    makeup: {
      type: Object,
      required: true,
    },

    showStudent: {
      type: Boolean,
      default: false,
    },

    editable: {
      type: Boolean,
      default: false,
    },

    loading: {
      type: Boolean,
      default: false,
    },
  })

const emit =
  defineEmits([
    'cancel',
    'restore',
  ])

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
// Date Time
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
// Status
// ============================================================

const isCancelled =
  computed(() => {
    return (
      props.makeup
        ?.status ===
      'CANCELLED'
    )
  })

const getAttendanceLabel = (
  value
) => {
  const map = {
    ATTENDED:
      '已上課',

    LEAVE:
      '請假',

    ABSENT:
      '缺席',

    CANCELLED:
      '已取消',
  }

  return (
    map[value] ||
    value ||
    '-'
  )
}

// ============================================================
// Creator
// ============================================================

const creatorLabel =
  computed(() => {
    const role =
      props.makeup
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

// ============================================================
// Actions
// ============================================================

const cancelMakeup =
  () => {
    if (
      props.loading ||
      isCancelled.value
    ) {
      return
    }

    emit(
      'cancel',
      props.makeup
    )
  }

const restoreMakeup =
  () => {
    if (
      props.loading ||
      !isCancelled.value
    ) {
      return
    }

    emit(
      'restore',
      props.makeup
    )
  }
</script>

<template>
  <article
    class="makeup-card"
    :class="{
      'makeup-card--cancelled':
        isCancelled,
    }"
  >
    <!-- ======================================================
         Header
         ====================================================== -->

    <header class="card-header">
      <div>
        <span class="eyebrow">
          Makeup
        </span>

        <h3>
          {{
            makeup.course_name
          }}
        </h3>

        <p
          v-if="
            showStudent &&
            makeup.student_name
          "
        >
          {{
            makeup.student_name
          }}
        </p>

        <span class="cycle">
          第
          {{
            makeup.package_cycle_no ||
            '-'
          }}
          期
        </span>
      </div>

      <span
        class="status-badge"
        :class="{
          'status-badge--cancelled':
            isCancelled,
        }"
      >
        {{
          isCancelled
            ? '已取消'
            : '有效'
        }}
      </span>
    </header>

    <!-- ======================================================
         Route
         ====================================================== -->

    <div class="makeup-route">
      <!-- Source -->

      <div class="route-item">
        <span class="route-label">
          原請假
        </span>

        <strong>
          {{
            formatDate(
              makeup.source_class_date
            )
          }}
        </strong>

        <p>
          {{
            formatTime(
              makeup.source_start_time
            )
          }}

          <template
            v-if="
              makeup.source_schedule_name
            "
          >
            ・
            {{
              makeup.source_schedule_name
            }}
          </template>
        </p>
      </div>

      <div class="route-arrow">
        ↓
      </div>

      <!-- Makeup -->

      <div
        class="
          route-item
          route-item--makeup
        "
      >
        <span class="route-label">
          補課
        </span>

        <strong>
          {{
            formatDate(
              makeup.makeup_class_date
            )
          }}
        </strong>

        <p>
          {{
            formatTime(
              makeup.makeup_start_time
            )
          }}

          <template
            v-if="
              makeup.makeup_end_time
            "
          >
            -
            {{
              formatTime(
                makeup.makeup_end_time
              )
            }}
          </template>

          <template
            v-if="
              makeup.makeup_schedule_name
            "
          >
            ・
            {{
              makeup.makeup_schedule_name
            }}
          </template>
        </p>
      </div>
    </div>

    <!-- ======================================================
         Attendance
         ====================================================== -->

    <div class="attendance-row">
      <span>
        補課 Attendance
      </span>

      <strong>
        {{
          getAttendanceLabel(
            makeup.makeup_attendance_status
          )
        }}
      </strong>
    </div>

    <!-- ======================================================
         Note
         ====================================================== -->

    <div
      v-if="
        makeup.note
      "
      class="note"
    >
      <span>
        備註
      </span>

      <p>
        {{
          makeup.note
        }}
      </p>
    </div>

    <!-- ======================================================
         Footer
         ====================================================== -->

    <footer class="card-footer">
      <span
        v-if="
          makeup.created_by_role
        "
      >
        建立：
        {{
          creatorLabel
        }}
      </span>

      <span>
        {{
          formatDateTime(
            makeup.created_at
          )
        }}
      </span>
    </footer>

    <!-- ======================================================
         Actions
         下一批接 Cancel / Restore API 後即可直接使用
         ====================================================== -->

    <div
      v-if="
        editable
      "
      class="card-actions"
    >
      <button
        v-if="
          !isCancelled
        "
        type="button"
        class="cancel-button"
        :disabled="
          loading
        "
        @click="
          cancelMakeup
        "
      >
        {{
          loading
            ? '處理中...'
            : '取消補課'
        }}
      </button>

      <button
        v-else
        type="button"
        class="restore-button"
        :disabled="
          loading
        "
        @click="
          restoreMakeup
        "
      >
        {{
          loading
            ? '處理中...'
            : '恢復補課'
        }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.makeup-card {
  padding: 17px;
  background: #ffffff;
  border: 1px solid #eeeeee;
  border-radius: 18px;
}

.makeup-card--cancelled {
  background: #fafafa;
  opacity: 0.7;
}

/* ============================================================
   Header
   ============================================================ */

.card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
}

.eyebrow {
  color: #aaaaaa;
  font-size: 9px;
  letter-spacing: 1px;
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

.cycle {
  display: inline-block;
  margin-top: 6px;
  color: #999999;
  font-size: 9px;
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

/* ============================================================
   Route
   ============================================================ */

.makeup-route {
  margin-top: 15px;
  padding: 13px;
  background: #f7f7f7;
  border-radius: 13px;
}

.route-item {
  display: flex;
  flex-direction: column;
}

.route-label {
  color: #999999;
  font-size: 8px;
}

.route-item strong {
  margin-top: 3px;
  font-size: 12px;
}

.route-item p {
  margin: 4px 0 0;
  color: #777777;
  font-size: 9px;
}

.route-item--makeup {
  padding: 10px;
  background: #ffffff;
  border-radius: 10px;
}

.route-arrow {
  padding: 7px 0;
  color: #aaaaaa;
  font-size: 12px;
  text-align: center;
}

/* ============================================================
   Attendance
   ============================================================ */

.attendance-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  padding: 10px;
  background: #f7f7f7;
  border-radius: 10px;
}

.attendance-row span {
  color: #888888;
  font-size: 9px;
}

.attendance-row strong {
  font-size: 10px;
}

/* ============================================================
   Note
   ============================================================ */

.note {
  margin-top: 10px;
}

.note span {
  color: #999999;
  font-size: 8px;
}

.note p {
  margin: 4px 0 0;
  color: #666666;
  font-size: 10px;
  line-height: 1.6;
}

/* ============================================================
   Footer
   ============================================================ */

.card-footer {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #eeeeee;
  color: #aaaaaa;
  font-size: 8px;
}

/* ============================================================
   Actions
   ============================================================ */

.card-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 11px;
}

.card-actions button {
  min-height: 34px;
  padding: 0 11px;
  border: 0;
  border-radius: 9px;
  font-size: 9px;
}

.cancel-button {
  background: #fff0f0;
  color: #c94343;
}

.restore-button {
  background: #222222;
  color: #ffffff;
}
</style>