<script setup>
const props =
  defineProps({
    modelValue: {
      type: Boolean,
      default: false,
    },

    teacherMode: {
      type: Boolean,
      default: false,
    },

    students: {
      type: Array,
      default: () => [],
    },

    leaves: {
      type: Array,
      default: () => [],
    },

    sessions: {
      type: Array,
      default: () => [],
    },

    loading: {
      type: Boolean,
      default: false,
    },
  })

const emit =
  defineEmits([
    'update:modelValue',
    'submit',
  ])

// ============================================================
// State
// ============================================================

const form =
  reactive({
    studentId: '',
    sourceLeaveAttendanceId: '',
    makeupSessionId: '',
    note: '',
  })

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
// Leaves
// ============================================================

const availableLeaves =
  computed(() => {
    if (
      !props.teacherMode
    ) {
      return props.leaves
    }

    if (
      !form.studentId
    ) {
      return []
    }

    return props.leaves.filter(
      (
        leave
      ) => {
        return (
          String(
            leave.student_id
          ) ===
          String(
            form.studentId
          )
        )
      }
    )
  })

// ============================================================
// Selected Leave
// ============================================================

const selectedLeave =
  computed(() => {
    return props.leaves.find(
      (
        leave
      ) => {
        return (
          String(
            leave.attendance_id
          ) ===
          String(
            form.sourceLeaveAttendanceId
          )
        )
      }
    ) ||
    null
  })

// ============================================================
// Sessions
//
// 最重要：
// 只顯示跟來源 Leave 同一 Course。
// ============================================================

const availableSessions =
  computed(() => {
    if (
      !selectedLeave.value
    ) {
      return []
    }

    return props.sessions.filter(
      (
        session
      ) => {
        if (
          String(
            session.course_id
          ) !==
          String(
            selectedLeave.value
              .course_id
          )
        ) {
          return false
        }

        if (
          String(
            session.id
          ) ===
          String(
            selectedLeave.value
              .session_id
          )
        ) {
          return false
        }

        return true
      }
    )
  })

// ============================================================
// Leave Label
// ============================================================

const getLeaveLabel = (
  leave
) => {
  return [
    leave.student_name,
    leave.course_name,
    formatDate(
      leave.class_date
    ),
    formatTime(
      leave.start_time
    ),
    leave.schedule_name,
  ]
    .filter(
      Boolean
    )
    .join('｜')
}

// ============================================================
// Session Label
// ============================================================

const getSessionLabel = (
  session
) => {
  return [
    formatDate(
      session.class_date
    ),

    getWeekdayLabel(
      session.weekday
    ),

    formatTime(
      session.start_time
    ),

    session.schedule_name,

    session.is_fixed_schedule
      ? '原固定班'
      : '其他時段',
  ]
    .filter(
      Boolean
    )
    .join('｜')
}

// ============================================================
// Reset
// ============================================================

const reset =
  () => {
    form.studentId =
      ''

    form.sourceLeaveAttendanceId =
      ''

    form.makeupSessionId =
      ''

    form.note =
      ''
  }

// ============================================================
// Close
// ============================================================

const close =
  () => {
    if (
      props.loading
    ) {
      return
    }

    emit(
      'update:modelValue',
      false
    )
  }

// ============================================================
// Submit
// ============================================================

const submit =
  () => {
    if (
      props.loading
    ) {
      return
    }

    if (
      props.teacherMode &&
      !form.studentId
    ) {
      return
    }

    if (
      !form.sourceLeaveAttendanceId ||
      !form.makeupSessionId
    ) {
      return
    }

    emit(
      'submit',
      {
        studentId:
          props.teacherMode
            ? form.studentId
            : undefined,

        sourceLeaveAttendanceId:
          form.sourceLeaveAttendanceId,

        makeupSessionId:
          form.makeupSessionId,

        note:
          form.note
            .trim() ||
          null,
      }
    )
  }

// ============================================================
// Watches
// ============================================================

watch(
  () =>
    props.modelValue,
  (
    visible
  ) => {
    if (
      visible
    ) {
      reset()
    }
  }
)

watch(
  () =>
    form.studentId,
  () => {
    form.sourceLeaveAttendanceId =
      ''

    form.makeupSessionId =
      ''
  }
)

watch(
  () =>
    form.sourceLeaveAttendanceId,
  () => {
    form.makeupSessionId =
      ''
  }
)
</script>

<template>
  <Teleport
    to="body"
  >
    <div
      v-if="
        modelValue
      "
      class="dialog-mask"
      @click.self="
        close
      "
    >
      <form
        class="dialog"
        @submit.prevent="
          submit
        "
      >
        <!-- =================================================
             Header
             ================================================= -->

        <header class="dialog-header">
          <div>
            <span>
              Makeup
            </span>

            <h2>
              安排補課
            </h2>
          </div>

          <button
            type="button"
            class="close-button"
            :disabled="
              loading
            "
            @click="
              close
            "
          >
            ×
          </button>
        </header>

        <p class="description">
          補課只能選擇與原請假相同的課程；不同 Schedule 可以互相補課。
        </p>

        <!-- =================================================
             Student
             ================================================= -->

        <label
          v-if="
            teacherMode
          "
        >
          學生

          <select
            v-model="
              form.studentId
            "
            required
            :disabled="
              loading
            "
          >
            <option value="">
              請選擇學生
            </option>

            <option
              v-for="
                student in
                  students
              "
              :key="
                student.id
              "
              :value="
                student.id
              "
            >
              {{
                student.name
              }}
            </option>
          </select>
        </label>

        <!-- =================================================
             Leave
             ================================================= -->

        <label>
          要補哪一堂請假？

          <select
            v-model="
              form.sourceLeaveAttendanceId
            "
            required
            :disabled="
              loading ||
              (
                teacherMode &&
                !form.studentId
              )
            "
          >
            <option value="">
              請選擇請假紀錄
            </option>

            <option
              v-for="
                leave in
                  availableLeaves
              "
              :key="
                leave.attendance_id
              "
              :value="
                leave.attendance_id
              "
            >
              {{
                getLeaveLabel(
                  leave
                )
              }}
            </option>
          </select>
        </label>

        <!-- =================================================
             Source Preview
             ================================================= -->

        <div
          v-if="
            selectedLeave
          "
          class="source-preview"
        >
          <span>
            原請假
          </span>

          <strong>
            {{
              selectedLeave
                .course_name
            }}
          </strong>

          <p>
            {{
              formatDate(
                selectedLeave
                  .class_date
              )
            }}

            ・

            {{
              formatTime(
                selectedLeave
                  .start_time
              )
            }}

            <template
              v-if="
                selectedLeave
                  .schedule_name
              "
            >
              ・
              {{
                selectedLeave
                  .schedule_name
              }}
            </template>
          </p>

          <small>
            第
            {{
              selectedLeave
                .package_cycle_no ||
              '-'
            }}
            期
          </small>
        </div>

        <!-- =================================================
             Makeup Session
             ================================================= -->

        <label>
          補到哪一堂？

          <select
            v-model="
              form.makeupSessionId
            "
            required
            :disabled="
              loading ||
              !selectedLeave
            "
          >
            <option value="">
              請選擇補課課堂
            </option>

            <option
              v-for="
                session in
                  availableSessions
              "
              :key="
                session.id
              "
              :value="
                session.id
              "
            >
              {{
                getSessionLabel(
                  session
                )
              }}
            </option>
          </select>
        </label>

        <div
          v-if="
            selectedLeave &&
            !availableSessions.length
          "
          class="warning"
        >
          目前沒有同一門課可使用的補課 Session。
        </div>

        <!-- =================================================
             Note
             ================================================= -->

        <label>
          備註

          <textarea
            v-model="
              form.note
            "
            rows="3"
            maxlength="2000"
            placeholder="可留空"
            :disabled="
              loading
            "
          />
        </label>

        <!-- =================================================
             Actions
             ================================================= -->

        <div class="dialog-actions">
          <button
            type="button"
            :disabled="
              loading
            "
            @click="
              close
            "
          >
            取消
          </button>

          <button
            type="submit"
            class="confirm"
            :disabled="
              loading ||
              (
                teacherMode &&
                !form.studentId
              ) ||
              !form.sourceLeaveAttendanceId ||
              !form.makeupSessionId
            "
          >
            {{
              loading
                ? '建立中...'
                : '確認補課'
            }}
          </button>
        </div>
      </form>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgb(0 0 0 / 48%);
}

.dialog {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 520px;
  max-height:
    calc(
      100vh - 36px
    );
  overflow-y: auto;
  padding: 22px;
  background: #ffffff;
  border-radius: 22px;
}

.dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.dialog-header span {
  color: #999999;
  font-size: 9px;
  letter-spacing: 1px;
}

.dialog-header h2 {
  margin: 4px 0 0;
  font-size: 20px;
}

.close-button {
  width: 35px;
  height: 35px;
  border: 0;
  background: #f2f2f2;
  border-radius: 50%;
  font-size: 18px;
}

.description {
  margin: 0;
  color: #777777;
  font-size: 10px;
  line-height: 1.7;
}

.dialog label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 10px;
  font-weight: 600;
}

.dialog select,
.dialog textarea {
  min-height: 41px;
  padding: 8px 10px;
  border: 1px solid #dddddd;
  background: #ffffff;
  border-radius: 10px;
  font: inherit;
  font-weight: 400;
}

.source-preview {
  padding: 12px;
  background: #f7f7f7;
  border-radius: 12px;
}

.source-preview span {
  color: #999999;
  font-size: 8px;
}

.source-preview strong {
  display: block;
  margin-top: 4px;
  font-size: 12px;
}

.source-preview p {
  margin: 4px 0 0;
  color: #777777;
  font-size: 9px;
}

.source-preview small {
  display: block;
  margin-top: 6px;
  color: #999999;
  font-size: 8px;
}

.warning {
  padding: 10px;
  background: #fff4dc;
  border-radius: 10px;
  color: #8d691e;
  font-size: 9px;
}

.dialog-actions {
  display: grid;
  grid-template-columns:
    1fr
    1fr;
  gap: 8px;
}

.dialog-actions button {
  min-height: 41px;
  border: 0;
  background: #eeeeee;
  border-radius: 10px;
  font-size: 10px;
}

.dialog-actions .confirm {
  background: #222222;
  color: #ffffff;
}

.dialog-actions button:disabled {
  opacity: 0.45;
}
</style>