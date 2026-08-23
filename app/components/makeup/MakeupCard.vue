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

    showStudent: {
      type: Boolean,
      default: false,
    },
  })

// ============================================================
// Emits
// ============================================================

const emit =
  defineEmits([
    'action',
  ])

// ============================================================
// Note
// ============================================================

const note =
  ref(
    props.record.note ||
    ''
  )

// ============================================================
// Cancellation Reason
// ============================================================

const cancellationReason =
  ref('')

// ============================================================
// Format
// ============================================================

const formatDate = (
  value
) => {
  if (
    !value
  ) {
    return '-'
  }

  return String(
    value
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
        .used_sessions ||
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

const progress =
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
// State
// ============================================================

const isActive =
  computed(() => {
    return (
      props.record.status ===
      'ACTIVE'
    )
  })

const isCancelled =
  computed(() => {
    return (
      props.record.status ===
      'CANCELLED'
    )
  })

// ============================================================
// Data Conflict
// ============================================================

const hasAttendanceConflict =
  computed(() => {
    if (
      isActive.value
    ) {
      return !(
        props.record
          .makeup_attendance_status ===
          'ATTENDED' &&
        props.record
          .makeup_attendance_type ===
          'MAKEUP'
      )
    }

    if (
      isCancelled.value
    ) {
      return !(
        props.record
          .makeup_attendance_status ===
          'CANCELLED' &&
        props.record
          .makeup_attendance_type ===
          'MAKEUP'
      )
    }

    return false
  })

// ============================================================
// Note Dirty
// ============================================================

const noteDirty =
  computed(() => {
    return (
      note.value.trim() !==
      String(
        props.record.note ||
        ''
      ).trim()
    )
  })

// ============================================================
// Update Note
// ============================================================

const updateNote =
  () => {
    if (
      props.saving ||
      !noteDirty.value
    ) {
      return
    }

    emit(
      'action',
      {
        makeupId:
          props.record.id,

        action:
          'UPDATE_NOTE',

        note:
          note.value.trim() ||
          null,
      }
    )
  }

// ============================================================
// Cancel
// ============================================================

const cancel =
  () => {
    if (
      props.saving ||
      !isActive.value
    ) {
      return
    }

    if (
      !window.confirm(
        '確定要取消這筆補課嗎？取消後會扣回這一堂實際出席。'
      )
    ) {
      return
    }

    emit(
      'action',
      {
        makeupId:
          props.record.id,

        action:
          'CANCEL',

        reason:
          cancellationReason.value
            .trim() ||
          null,
      }
    )
  }

// ============================================================
// Restore
// ============================================================

const restore =
  () => {
    if (
      props.saving ||
      !isCancelled.value
    ) {
      return
    }

    if (
      !window.confirm(
        '確定要恢復這筆補課嗎？恢復後會重新累加 1 堂實際出席。'
      )
    ) {
      return
    }

    emit(
      'action',
      {
        makeupId:
          props.record.id,

        action:
          'RESTORE',
      }
    )
  }

// ============================================================
// Watch
// ============================================================

watch(
  () =>
    props.record,
  (
    value
  ) => {
    note.value =
      value.note ||
      ''

    cancellationReason.value =
      value.cancellation_reason ||
      ''
  },
  {
    deep: true,
  }
)
</script>

<template>
  <article
    class="makeup-card"
    :class="{
      cancelled:
        isCancelled,

      conflict:
        hasAttendanceConflict,
    }"
  >
    <!-- ======================================================
         Header
         ====================================================== -->

    <header>
      <div>
        <span
          v-if="
            showStudent
          "
          class="student-name"
        >
          {{
            record.student_name
          }}
        </span>

        <small>
          Makeup
        </small>

        <h3>
          {{
            record.course_name
          }}
        </h3>
      </div>

      <span
        class="status"
        :class="{
          active:
            isActive,

          cancelled:
            isCancelled,
        }"
      >
        {{
          isActive
            ? '進行中'
            : '已取消'
        }}
      </span>
    </header>

    <!-- ======================================================
         Dates
         ====================================================== -->

    <section class="date-flow">
      <div>
        <span>
          原本請假
        </span>

        <strong>
          {{
            formatDate(
              record.source_class_date
            )
          }}
        </strong>

        <small>
          {{
            formatTime(
              record.source_start_time
            )
          }}
        </small>
      </div>

      <div class="arrow">
        →
      </div>

      <div>
        <span>
          補課
        </span>

        <strong>
          {{
            formatDate(
              record.makeup_class_date
            )
          }}
        </strong>

        <small>
          {{
            formatTime(
              record.makeup_start_time
            )
          }}
          –
          {{
            formatTime(
              record.makeup_end_time
            )
          }}
        </small>
      </div>
    </section>

    <!-- ======================================================
         Package
         ====================================================== -->

    <section class="package">
      <div class="package-title">
        <span>
          方案堂數
        </span>

        <strong>
          {{
            usedSessions
          }}
          /
          {{
            totalSessions
          }}

          <small>
            剩
            {{
              remainingSessions
            }}
            堂
          </small>
        </strong>
      </div>

      <div class="progress-track">
        <div
          class="progress-value"
          :style="{
            width:
              `${progress}%`,
          }"
        />
      </div>
    </section>

    <!-- ======================================================
         Attendance
         ====================================================== -->

    <section class="attendance-state">
      <div>
        <span>
          補課 Attendance
        </span>

        <strong>
          {{
            record.makeup_attendance_status ||
            '不存在'
          }}
        </strong>
      </div>

      <div>
        <span>
          類型
        </span>

        <strong>
          {{
            record.makeup_attendance_type ||
            '-'
          }}
        </strong>
      </div>
    </section>

    <!-- ======================================================
         Conflict
         ====================================================== -->

    <div
      v-if="
        hasAttendanceConflict
      "
      class="conflict-message"
    >
      <strong>
        資料需要檢查
      </strong>

      <p>
        補課狀態與對應 Attendance 已不一致。系統會阻止取消或恢復直接覆蓋資料，請由老師確認 Audit Log。
      </p>
    </div>

    <!-- ======================================================
         Note
         ====================================================== -->

    <label class="note-field">
      <span>
        補課備註
      </span>

      <input
        v-model="
          note
        "
        type="text"
        maxlength="2000"
        placeholder="補課備註..."
        :disabled="
          saving
        "
      >
    </label>

    <button
      type="button"
      class="save-note"
      :disabled="
        saving ||
        !noteDirty
      "
      @click="
        updateNote
      "
    >
      儲存備註
    </button>

    <!-- ======================================================
         Cancel
         ====================================================== -->

    <template
      v-if="
        isActive
      "
    >
      <label class="cancel-reason">
        <span>
          取消原因（選填）
        </span>

        <input
          v-model="
            cancellationReason
          "
          type="text"
          maxlength="2000"
          placeholder="例如：補課日期臨時有事"
          :disabled="
            saving
          "
        >
      </label>

      <button
        type="button"
        class="cancel-button"
        :disabled="
          saving ||
          hasAttendanceConflict
        "
        @click="
          cancel
        "
      >
        {{
          saving
            ? '處理中...'
            : '取消這次補課'
        }}
      </button>
    </template>

    <!-- ======================================================
         Restore
         ====================================================== -->

    <button
      v-else-if="
        isCancelled
      "
      type="button"
      class="restore-button"
      :disabled="
        saving ||
        hasAttendanceConflict
      "
      @click="
        restore
      "
    >
      {{
        saving
          ? '處理中...'
          : '恢復這次補課'
      }}
    </button>

    <!-- ======================================================
         Footer
         ====================================================== -->

    <footer>
      <span>
        {{
          isActive
            ? '目前這堂補課有計入方案'
            : '目前這堂補課沒有計入方案'
        }}
      </span>

      <span
        v-if="
          record.cancellation_reason
        "
      >
        取消原因：
        {{
          record.cancellation_reason
        }}
      </span>
    </footer>
  </article>
</template>

<style scoped>
.makeup-card {
  padding: 15px;
  background: #ffffff;
  border: 1px solid transparent;
  border-radius: 16px;
}

.makeup-card.cancelled {
  opacity: 0.78;
}

.makeup-card.conflict {
  border-color: #e4b1b1;
}

.makeup-card > header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.student-name {
  display: block;
  margin-bottom: 4px;
  color: #555555;
  font-size: 10px;
  font-weight: 700;
}

.makeup-card header small {
  color: #999999;
  font-size: 7px;
  letter-spacing: 1px;
}

.makeup-card h3 {
  margin: 3px 0 0;
  font-size: 15px;
}

.status {
  height: fit-content;
  padding: 5px 8px;
  background: #eeeeee;
  border-radius: 999px;
  font-size: 8px;
}

.status.active {
  background: #eaf7ec;
  color: #418b4b;
}

.status.cancelled {
  background: #eeeeee;
  color: #888888;
}

/* ============================================================
   Dates
   ============================================================ */

.date-flow {
  display: grid;
  grid-template-columns:
    1fr
    auto
    1fr;
  align-items: center;
  gap: 9px;
  margin-top: 12px;
}

.date-flow > div:not(.arrow) {
  padding: 10px;
  background: #f7f7f7;
  border-radius: 10px;
}

.date-flow span {
  display: block;
  color: #999999;
  font-size: 7px;
}

.date-flow strong {
  display: block;
  margin-top: 4px;
  font-size: 10px;
}

.date-flow small {
  display: block;
  margin-top: 3px;
  color: #888888;
  font-size: 7px;
}

.arrow {
  color: #aaaaaa;
}

/* ============================================================
   Package
   ============================================================ */

.package {
  margin-top: 10px;
  padding: 11px;
  background: #222222;
  border-radius: 11px;
  color: #ffffff;
}

.package-title {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.package-title span {
  color: rgb(255 255 255 / 55%);
  font-size: 8px;
}

.package-title strong {
  font-size: 10px;
}

.package-title small {
  margin-left: 6px;
  color: rgb(255 255 255 / 55%);
  font-size: 7px;
}

.progress-track {
  height: 5px;
  margin-top: 8px;
  overflow: hidden;
  background: rgb(255 255 255 / 18%);
  border-radius: 999px;
}

.progress-value {
  height: 100%;
  background: #ffffff;
  border-radius: 999px;
}

/* ============================================================
   Attendance
   ============================================================ */

.attendance-state {
  display: grid;
  grid-template-columns:
    1fr
    1fr;
  gap: 6px;
  margin-top: 9px;
}

.attendance-state > div {
  padding: 9px;
  background: #f7f7f7;
  border-radius: 9px;
}

.attendance-state span {
  display: block;
  color: #999999;
  font-size: 7px;
}

.attendance-state strong {
  display: block;
  margin-top: 3px;
  font-size: 9px;
}

/* ============================================================
   Conflict
   ============================================================ */

.conflict-message {
  margin-top: 9px;
  padding: 10px;
  background: #fff0f0;
  border-radius: 9px;
}

.conflict-message strong {
  color: #c94343;
  font-size: 9px;
}

.conflict-message p {
  margin: 4px 0 0;
  color: #9b5c5c;
  font-size: 8px;
  line-height: 1.6;
}

/* ============================================================
   Inputs
   ============================================================ */

.note-field,
.cancel-reason {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 10px;
}

.note-field span,
.cancel-reason span {
  color: #888888;
  font-size: 7px;
}

.note-field input,
.cancel-reason input {
  min-height: 35px;
  padding: 0 9px;
  border: 1px solid #dddddd;
  background: #ffffff;
  border-radius: 8px;
  font-size: 8px;
}

.save-note,
.cancel-button,
.restore-button {
  width: 100%;
  min-height: 36px;
  margin-top: 7px;
  border: 0;
  border-radius: 8px;
  font-size: 8px;
}

.save-note {
  background: #eeeeee;
  color: #555555;
}

.cancel-button {
  background: #fff0f0;
  color: #c94343;
}

.restore-button {
  background: #eaf7ec;
  color: #418b4b;
}

button:disabled {
  opacity: 0.4;
}

/* ============================================================
   Footer
   ============================================================ */

.makeup-card > footer {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px solid #eeeeee;
  color: #aaaaaa;
  font-size: 7px;
}
</style>