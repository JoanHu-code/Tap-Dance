<script setup>
const props =
  defineProps({
    sessions: {
      type: Array,
      default: () => [],
    },

    courseId: {
      type: String,
      default: '',
    },

    modelValue: {
      type: Array,
      default: () => [],
    },

    disabled: {
      type: Boolean,
      default: false,
    },
  })

const emit =
  defineEmits([
    'update:modelValue',
  ])

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
// Sessions
// ============================================================

const filteredSessions =
  computed(() => {
    if (
      !props.courseId
    ) {
      return []
    }

    return props.sessions
      .filter(
        (
          session
        ) => {
          return (
            String(
              session.course_id
            ) ===
            String(
              props.courseId
            )
          )
        }
      )
      .sort(
        (
          a,
          b
        ) => {
          const dateCompare =
            String(
              a.class_date
            ).localeCompare(
              String(
                b.class_date
              )
            )

          if (
            dateCompare !== 0
          ) {
            return dateCompare
          }

          return String(
            a.start_time ||
            ''
          ).localeCompare(
            String(
              b.start_time ||
              ''
            )
          )
        }
      )
  })

// ============================================================
// Selected
// ============================================================

const isSelected = (
  sessionId
) => {
  return props.modelValue
    .map(
      String
    )
    .includes(
      String(
        sessionId
      )
    )
}

// ============================================================
// Selectable
// ============================================================

const isSelectable = (
  session
) => {
  if (
    props.disabled
  ) {
    return false
  }

  if (
    session.status ===
      'TEACHER_LEAVE' ||
    session.status ===
      'CANCELLED'
  ) {
    return false
  }

  // ========================================================
  // 已經 LEAVE
  // 不需要再次選。
  // ========================================================

  if (
    session.attendance_status ===
    'LEAVE'
  ) {
    return false
  }

  // ========================================================
  // 已取消 Attendance
  // Leave Service 本身也會拒絕，
  // 這裡 UI 直接禁用。
  // ========================================================

  if (
    session.attendance_status ===
    'CANCELLED'
  ) {
    return false
  }

  return true
}

// ============================================================
// Toggle
// ============================================================

const toggle = (
  session
) => {
  if (
    !isSelectable(
      session
    )
  ) {
    return
  }

  const id =
    String(
      session.id
    )

  const current =
    props.modelValue
      .map(
        String
      )

  if (
    current.includes(
      id
    )
  ) {
    emit(
      'update:modelValue',
      current.filter(
        (
          item
        ) => {
          return (
            item !==
            id
          )
        }
      )
    )

    return
  }

  emit(
    'update:modelValue',
    [
      ...current,
      id,
    ]
  )
}

// ============================================================
// Select All
// ============================================================

const selectAll =
  () => {
    const ids =
      filteredSessions.value
        .filter(
          (
            session
          ) => {
            return isSelectable(
              session
            )
          }
        )
        .map(
          (
            session
          ) => {
            return String(
              session.id
            )
          }
        )

    emit(
      'update:modelValue',
      ids
    )
  }

// ============================================================
// Clear
// ============================================================

const clearAll =
  () => {
    emit(
      'update:modelValue',
      []
    )
  }
</script>

<template>
  <div class="leave-session-picker">
    <div class="picker-header">
      <div>
        <strong>
          選擇請假課堂
        </strong>

        <span>
          已選
          {{ modelValue.length }}
          堂
        </span>
      </div>

      <div class="picker-actions">
        <button
          type="button"
          :disabled="
            !courseId ||
            disabled
          "
          @click="
            selectAll
          "
        >
          全選
        </button>

        <button
          type="button"
          :disabled="
            !modelValue.length ||
            disabled
          "
          @click="
            clearAll
          "
        >
          清除
        </button>
      </div>
    </div>

    <div
      v-if="
        !courseId
      "
      class="empty-state"
    >
      請先選擇課程。
    </div>

    <div
      v-else-if="
        !filteredSessions.length
      "
      class="empty-state"
    >
      目前沒有可以顯示的課堂。
    </div>

    <div
      v-else
      class="session-list"
    >
      <button
        v-for="
          session in
            filteredSessions
        "
        :key="
          session.id
        "
        type="button"
        class="session-option"
        :class="{
          'session-option--selected':
            isSelected(
              session.id
            ),

          'session-option--disabled':
            !isSelectable(
              session
            ),
        }"
        :disabled="
          !isSelectable(
            session
          )
        "
        @click="
          toggle(
            session
          )
        "
      >
        <span class="checkbox">
          {{
            isSelected(
              session.id
            )
              ? '✓'
              : ''
          }}
        </span>

        <span class="session-info">
          <strong>
            {{
              formatDate(
                session.class_date
              )
            }}

            ・

            {{
              getWeekdayLabel(
                session.weekday
              )
            }}
          </strong>

          <span>
            {{
              formatTime(
                session.start_time
              )
            }}

            <template
              v-if="
                session.end_time
              "
            >
              -
              {{
                formatTime(
                  session.end_time
                )
              }}
            </template>

            <template
              v-if="
                session.schedule_name
              "
            >
              ・
              {{
                session.schedule_name
              }}
            </template>
          </span>
        </span>

        <span
          v-if="
            session.is_primary
          "
          class="primary-badge"
        >
          主要
        </span>

        <span
          v-if="
            session.attendance_status ===
            'LEAVE'
          "
          class="existing-badge"
        >
          已請假
        </span>

        <span
          v-else-if="
            session.attendance_status
          "
          class="existing-badge"
        >
          {{
            session.attendance_status
          }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.leave-session-picker {
  margin-top: 14px;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.picker-header > div:first-child {
  display: flex;
  flex-direction: column;
}

.picker-header strong {
  font-size: 12px;
}

.picker-header span {
  margin-top: 3px;
  color: #999999;
  font-size: 10px;
}

.picker-actions {
  display: flex;
  gap: 6px;
}

.picker-actions button {
  min-height: 31px;
  padding: 0 9px;
  border: 0;
  background: #eeeeee;
  border-radius: 8px;
  font-size: 9px;
  cursor: pointer;
}

.picker-actions button:disabled {
  opacity: 0.45;
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  max-height: 360px;
  margin-top: 10px;
  overflow-y: auto;
}

.session-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 57px;
  padding: 9px 11px;
  border: 1px solid #eeeeee;
  background: #fafafa;
  border-radius: 12px;
  color: #333333;
  text-align: left;
  cursor: pointer;
}

.session-option--selected {
  border-color: #222222;
  background: #f0f0f0;
}

.session-option--disabled {
  cursor: default;
  opacity: 0.48;
}

.checkbox {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 25px;
  height: 25px;
  border: 1px solid #cccccc;
  background: #ffffff;
  border-radius: 7px;
  font-size: 10px;
}

.session-option--selected
.checkbox {
  border-color: #222222;
  background: #222222;
  color: #ffffff;
}

.session-info {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.session-info strong {
  font-size: 11px;
}

.session-info > span {
  margin-top: 4px;
  color: #888888;
  font-size: 9px;
}

.primary-badge,
.existing-badge {
  flex: 0 0 auto;
  padding: 4px 7px;
  background: #eeeeee;
  border-radius: 999px;
  font-size: 8px;
}

.empty-state {
  margin-top: 10px;
  padding: 25px 12px;
  background: #f7f7f7;
  border-radius: 12px;
  color: #aaaaaa;
  font-size: 10px;
  text-align: center;
}
</style>