<script setup>
// ============================================================
// Props
// ============================================================

const props =
  defineProps({
    record: {
      type: Object,
      required: true,
    },

    saving: {
      type: Boolean,
      default: false,
    },
  })

// ============================================================
// Emits
// ============================================================

const emit =
  defineEmits([
    'update',
  ])

// ============================================================
// Local State
// ============================================================

const selectedStatus =
  ref(
    props.record.status
  )

const note =
  ref(
    props.record.note ||
    ''
  )

// ============================================================
// Status
// ============================================================

const statusOptions = [
  {
    value:
      'ATTENDED',

    label:
      '出席',
  },

  {
    value:
      'LEAVE',

    label:
      '請假',
  },

  {
    value:
      'ABSENT',

    label:
      '缺席',
  },

  {
    value:
      'CANCELLED',

    label:
      '取消',
  },
]

const getStatusLabel = (
  status
) => {
  return (
    statusOptions.find(
      (
        item
      ) => {
        return (
          item.value ===
          status
        )
      }
    )?.label ||
    status ||
    '-'
  )
}

// ============================================================
// Format
// ============================================================

const formatDate = (
  value
) => {
  return String(
    value || ''
  ).slice(
    0,
    10
  )
}

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
// Package
// ============================================================

const usedSessions =
  computed(() => {
    return Number(
      props.record
        .package_used_sessions ||
      0
    )
  })

const totalSessions =
  computed(() => {
    return Number(
      props.record
        .total_sessions ||
      0
    )
  })

const remainingSessions =
  computed(() => {
    return Math.max(
      totalSessions.value -
      usedSessions.value,
      0
    )
  })

const progressPercent =
  computed(() => {
    if (
      totalSessions.value <=
      0
    ) {
      return 0
    }

    return Math.min(
      Math.round(
        usedSessions.value /
        totalSessions.value *
        100
      ),
      100
    )
  })

// ============================================================
// Makeup
// ============================================================

const isMakeup =
  computed(() => {
    return (
      props.record
        .attendance_type ===
      'MAKEUP'
    )
  })

// ============================================================
// Dirty
// ============================================================

const isDirty =
  computed(() => {
    return (
      selectedStatus.value !==
        props.record.status ||
      note.value.trim() !==
        String(
          props.record.note ||
          ''
        ).trim()
    )
  })

// ============================================================
// Submit
// ============================================================

const submit =
  () => {
    if (
      props.saving ||
      isMakeup.value ||
      !isDirty.value
    ) {
      return
    }

    emit(
      'update',
      {
        attendanceId:
          props.record.id,

        status:
          selectedStatus.value,

        note:
          note.value.trim() ||
          null,
      }
    )
  }

// ============================================================
// Watch Record
// ============================================================

watch(
  () =>
    props.record,
  (
    value
  ) => {
    selectedStatus.value =
      value.status

    note.value =
      value.note ||
      ''
  },
  {
    deep: true,
  }
)
</script>

<template>
  <article
    class="attendance-card"
    :class="{
      'attendance-card--makeup':
        isMakeup,
    }"
  >
    <!-- ======================================================
         Header
         ====================================================== -->

    <header>
      <div>
        <span>
          {{
            formatDate(
              record.class_date
            )
          }}
        </span>

        <h3>
          {{
            record.course_name ||
            '課堂'
          }}
        </h3>

        <p>
          {{
            formatTime(
              record.start_time
            )
          }}
          –
          {{
            formatTime(
              record.end_time
            )
          }}
        </p>
      </div>

      <span
        class="status-badge"
        :class="
          String(
            record.status ||
            ''
          ).toLowerCase()
        "
      >
        {{
          getStatusLabel(
            record.status
          )
        }}
      </span>
    </header>

    <!-- ======================================================
         Package
         ====================================================== -->

    <section
      v-if="
        record.package_id
      "
      class="package-info"
    >
      <div>
        <span>
          方案進度
        </span>

        <strong>
          {{
            usedSessions
          }}
          /
          {{
            totalSessions
          }}
        </strong>
      </div>

      <div>
        <span>
          剩餘
        </span>

        <strong>
          {{
            remainingSessions
          }}
          堂
        </strong>
      </div>

      <div>
        <span>
          本次方案
        </span>

        <strong>
          {{
            record.purchased_cycles ||
            1
          }}
          期
        </strong>
      </div>
    </section>

    <!-- ======================================================
         Progress
         ====================================================== -->

    <div
      v-if="
        record.package_id
      "
      class="progress-track"
    >
      <div
        class="progress-value"
        :style="{
          width:
            `${progressPercent}%`,
        }"
      />
    </div>

    <!-- ======================================================
         Makeup
         ====================================================== -->

    <div
      v-if="
        isMakeup
      "
      class="makeup-notice"
    >
      <strong>
        補課紀錄
      </strong>

      <p>
        此筆出席是由補課產生，若要取消或恢復，請到「補課管理」操作，避免同一堂補課被重複計算。
      </p>

      <NuxtLink
        to="/student/makeup"
      >
        前往補課管理 →
      </NuxtLink>
    </div>

    <!-- ======================================================
         Edit
         ====================================================== -->

    <template
      v-else
    >
      <section class="status-actions">
        <button
          v-for="
            option in
              statusOptions
          "
          :key="
            option.value
          "
          type="button"
          :disabled="
            saving
          "
          :class="[
            option.value.toLowerCase(),

            {
              selected:
                selectedStatus ===
                  option.value,
            },
          ]"
          @click="
            selectedStatus =
              option.value
          "
        >
          {{
            option.label
          }}
        </button>
      </section>

      <label class="note-field">
        <span>
          備註
        </span>

        <input
          v-model="
            note
          "
          type="text"
          maxlength="2000"
          placeholder="選填..."
          :disabled="
            saving
          "
        >
      </label>

      <button
        type="button"
        class="save-button"
        :disabled="
          saving ||
          !isDirty
        "
        @click="
          submit
        "
      >
        {{
          saving
            ? '儲存中...'
            : '儲存修改'
        }}
      </button>
    </template>

    <!-- ======================================================
         Meta
         ====================================================== -->

    <footer>
      <span>
        {{
          record.attendance_type ===
            'MAKEUP'
            ? '補課'
            : record.attendance_type ===
                'MANUAL'
              ? '手動紀錄'
              : '一般課堂'
        }}
      </span>

      <span>
        {{
          record.package_status ||
          ''
        }}
      </span>
    </footer>
  </article>
</template>

<style scoped>
.attendance-card {
  padding: 15px;
  background: #ffffff;
  border-radius: 16px;
}

.attendance-card--makeup {
  border: 1px solid #dfe5ff;
}

.attendance-card > header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.attendance-card header > div > span {
  color: #999999;
  font-size: 8px;
}

.attendance-card h3 {
  margin: 3px 0 0;
  font-size: 15px;
}

.attendance-card header p {
  margin: 3px 0 0;
  color: #777777;
  font-size: 8px;
}

/* ============================================================
   Status
   ============================================================ */

.status-badge {
  height: fit-content;
  padding: 5px 8px;
  background: #eeeeee;
  border-radius: 999px;
  color: #777777;
  font-size: 8px;
}

.status-badge.attended {
  background: #eaf7ec;
  color: #418b4b;
}

.status-badge.leave {
  background: #fff5df;
  color: #8d691d;
}

.status-badge.absent {
  background: #fff0f0;
  color: #c94343;
}

.status-badge.cancelled {
  background: #eeeeee;
  color: #888888;
}

/* ============================================================
   Package
   ============================================================ */

.package-info {
  display: grid;
  grid-template-columns:
    repeat(
      3,
      1fr
    );
  gap: 6px;
  margin-top: 11px;
}

.package-info > div {
  padding: 9px;
  background: #f7f7f7;
  border-radius: 9px;
}

.package-info span {
  display: block;
  color: #999999;
  font-size: 7px;
}

.package-info strong {
  display: block;
  margin-top: 4px;
  font-size: 10px;
}

.progress-track {
  height: 5px;
  margin-top: 7px;
  overflow: hidden;
  background: #eeeeee;
  border-radius: 999px;
}

.progress-value {
  height: 100%;
  background: #222222;
  border-radius: 999px;
}

/* ============================================================
   Makeup
   ============================================================ */

.makeup-notice {
  margin-top: 11px;
  padding: 11px;
  background: #f3f5ff;
  border-radius: 10px;
}

.makeup-notice strong {
  color: #5267a4;
  font-size: 9px;
}

.makeup-notice p {
  margin: 5px 0 0;
  color: #6b76a0;
  font-size: 8px;
  line-height: 1.6;
}

.makeup-notice a {
  display: inline-block;
  margin-top: 7px;
  color: #5267a4;
  font-size: 8px;
  text-decoration: none;
}

/* ============================================================
   Actions
   ============================================================ */

.status-actions {
  display: grid;
  grid-template-columns:
    repeat(
      4,
      1fr
    );
  gap: 6px;
  margin-top: 12px;
}

.status-actions button {
  min-height: 34px;
  border: 1px solid transparent;
  background: #eeeeee;
  border-radius: 8px;
  color: #666666;
  font-size: 8px;
}

.status-actions .attended.selected {
  background: #eaf7ec;
  border-color: #b6dfbc;
  color: #418b4b;
}

.status-actions .leave.selected {
  background: #fff5df;
  border-color: #ead299;
  color: #8d691d;
}

.status-actions .absent.selected {
  background: #fff0f0;
  border-color: #efb2b2;
  color: #c94343;
}

.status-actions .cancelled.selected {
  background: #dddddd;
  color: #666666;
}

/* ============================================================
   Note
   ============================================================ */

.note-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 8px;
}

.note-field span {
  color: #999999;
  font-size: 7px;
}

.note-field input {
  min-height: 35px;
  padding: 0 9px;
  border: 1px solid #dddddd;
  background: #ffffff;
  border-radius: 8px;
  font-size: 9px;
}

.save-button {
  width: 100%;
  min-height: 37px;
  margin-top: 8px;
  border: 0;
  background: #222222;
  border-radius: 9px;
  color: #ffffff;
  font-size: 9px;
}

.save-button:disabled {
  opacity: 0.4;
}

/* ============================================================
   Footer
   ============================================================ */

.attendance-card > footer {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px solid #eeeeee;
  color: #aaaaaa;
  font-size: 7px;
}

@media (
  max-width: 480px
) {
  .package-info {
    grid-template-columns:
      1fr
      1fr
      1fr;
  }

  .status-actions {
    grid-template-columns:
      1fr
      1fr;
  }
}
</style>