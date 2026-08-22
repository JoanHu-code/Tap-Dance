<script setup>
const props =
  defineProps({
    enrollment: {
      type: Object,
      required: true,
    },

    availableSchedules: {
      type: Array,
      default: () => [],
    },

    studentId: {
      type: String,
      required: true,
    },
  })

const emit =
  defineEmits([
    'updated',
  ])

const loading =
  ref(false)

const errorMessage =
  ref('')

const selectedScheduleIds =
  ref([])

const primaryScheduleId =
  ref('')

// ============================================================
// 這個 Enrollment 所屬 Course 的所有 Schedule
// ============================================================

const courseSchedules =
  computed(() => {
    return props.availableSchedules
      .filter(
        (
          schedule
        ) => {
          return (
            String(
              schedule.course_id
            ) ===
            String(
              props.enrollment
                .course_id
            )
          )
        }
      )
      .sort(
        (
          a,
          b
        ) => {
          const weekdayDiff =
            Number(
              a.weekday
            ) -
            Number(
              b.weekday
            )

          if (
            weekdayDiff !== 0
          ) {
            return weekdayDiff
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
// 星期
// ============================================================

const getWeekdayLabel =
  (
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
      `星期 ${weekday}`
    )
  }

// ============================================================
// Schedule 顯示文字
// ============================================================

const getScheduleLabel =
  (
    schedule
  ) => {
    const weekday =
      getWeekdayLabel(
        schedule.weekday
      )

    const startTime =
      String(
        schedule.start_time ||
        ''
      )
        .slice(
          0,
          5
        )

    const endTime =
      schedule.end_time
        ? String(
            schedule.end_time
          )
            .slice(
              0,
              5
            )
        : ''

    const timeText =
      endTime
        ? `${startTime} - ${endTime}`
        : startTime

    const name =
      schedule.name
        ? `｜${schedule.name}`
        : ''

    return `${weekday} ${timeText} ${name}`
  }

// ============================================================
// 初始化
// ============================================================

const initialize =
  () => {
    const currentSchedules =
      Array.isArray(
        props.enrollment
          ?.schedules
      )
        ? props.enrollment
            .schedules
        : []

    selectedScheduleIds.value =
      currentSchedules
        .filter(
          (
            item
          ) => {
            return (
              item
                .enrollment_schedule_status !==
                'INACTIVE'
            )
          }
        )
        .map(
          (
            item
          ) => {
            return String(
              item.schedule_id
            )
          }
        )

    const primary =
      currentSchedules.find(
        (
          item
        ) => {
          return Boolean(
            item.is_primary
          )
        }
      )

    primaryScheduleId.value =
      primary
        ? String(
            primary.schedule_id
          )
        : (
            props.enrollment
              ?.default_schedule_id
              ? String(
                  props.enrollment
                    .default_schedule_id
                )
              : ''
          )

    if (
      primaryScheduleId.value &&
      !selectedScheduleIds.value
        .includes(
          primaryScheduleId.value
        )
    ) {
      selectedScheduleIds.value
        .unshift(
          primaryScheduleId.value
        )
    }
  }

// ============================================================
// 勾選 Schedule
// ============================================================

const toggleSchedule =
  (
    scheduleId
  ) => {
    const normalized =
      String(
        scheduleId
      )

    if (
      selectedScheduleIds.value
        .includes(
          normalized
        )
    ) {
      selectedScheduleIds.value =
        selectedScheduleIds.value
          .filter(
            (
              id
            ) => {
              return (
                id !==
                normalized
              )
            }
          )

      if (
        primaryScheduleId.value ===
        normalized
      ) {
        primaryScheduleId.value =
          selectedScheduleIds.value[0] ||
          ''
      }

      return
    }

    selectedScheduleIds.value =
      [
        ...selectedScheduleIds.value,
        normalized,
      ]

    if (
      !primaryScheduleId.value
    ) {
      primaryScheduleId.value =
        normalized
    }
  }

// ============================================================
// 是否勾選
// ============================================================

const isSelected =
  (
    scheduleId
  ) => {
    return selectedScheduleIds.value
      .includes(
        String(
          scheduleId
        )
      )
  }

// ============================================================
// 指定 Primary
// ============================================================

const setPrimary =
  (
    scheduleId
  ) => {
    const normalized =
      String(
        scheduleId
      )

    if (
      !isSelected(
        normalized
      )
    ) {
      selectedScheduleIds.value =
        [
          ...selectedScheduleIds.value,
          normalized,
        ]
    }

    primaryScheduleId.value =
      normalized
  }

// ============================================================
// Save
// ============================================================

const saveSchedules =
  async () => {
    if (
      loading.value
    ) {
      return
    }

    if (
      selectedScheduleIds.value
        .length >
        0 &&
      !primaryScheduleId.value
    ) {
      primaryScheduleId.value =
        selectedScheduleIds.value[0]
    }

    if (
      primaryScheduleId.value &&
      !selectedScheduleIds.value
        .includes(
          primaryScheduleId.value
        )
    ) {
      errorMessage.value =
        '主要班別必須包含在固定班別中'

      return
    }

    loading.value =
      true

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          `/api/teacher/students/${props.studentId}/enrollments/${props.enrollment.id}/schedules`,
          {
            method:
              'PUT',

            body: {
              scheduleIds:
                selectedScheduleIds.value,

              primaryScheduleId:
                primaryScheduleId.value ||
                null,
            },
          }
        )

      emit(
        'updated',
        response
      )
    } catch (error) {
      console.error(
        '更新固定班別失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        '固定班別更新失敗'
    } finally {
      loading.value =
        false
    }
  }

watch(
  () => [
    props.enrollment,
    props.enrollment
      ?.schedules,
  ],
  () => {
    initialize()
  },
  {
    deep: true,
    immediate: true,
  }
)
</script>

<template>
  <div
    class="
      schedule-editor
    "
  >
    <div
      v-if="
        errorMessage
      "
      class="
        editor-error
      "
    >
      {{
        errorMessage
      }}
    </div>

    <div
      v-if="
        !courseSchedules.length
      "
      class="
        editor-empty
      "
    >
      這門課目前尚未建立任何固定班別。
    </div>

    <div
      v-else
      class="
        schedule-options
      "
    >
      <div
        v-for="
          schedule in
            courseSchedules
        "
        :key="
          schedule.id
        "
        class="
          schedule-option
        "
        :class="{
          'schedule-option--selected':
            isSelected(
              schedule.id
            ),
        }"
      >
        <button
          type="button"
          class="
            schedule-select
          "
          @click="
            toggleSchedule(
              schedule.id
            )
          "
        >
          <span
            class="
              checkbox
            "
          >
            {{
              isSelected(
                schedule.id
              )
                ? '✓'
                : ''
            }}
          </span>

          <span
            class="
              schedule-label
            "
          >
            {{
              getScheduleLabel(
                schedule
              )
            }}
          </span>
        </button>

        <button
          v-if="
            isSelected(
              schedule.id
            )
          "
          type="button"
          class="
            primary-select
          "
          :class="{
            'primary-select--active':
              primaryScheduleId ===
              String(
                schedule.id
              ),
          }"
          @click="
            setPrimary(
              schedule.id
            )
          "
        >
          {{
            primaryScheduleId ===
            String(
              schedule.id
            )
              ? '主要班別'
              : '設為主要'
          }}
        </button>
      </div>
    </div>

    <div
      class="
        editor-footer
      "
    >
      <span>
        已選
        {{
          selectedScheduleIds.length
        }}
        個固定時段
      </span>

      <button
        type="button"
        class="
          save-button
        "
        :disabled="
          loading
        "
        @click="
          saveSchedules
        "
      >
        {{
          loading
            ? '儲存中...'
            : '儲存固定時段'
        }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.schedule-editor {
  margin-top: 14px;
}

.schedule-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.schedule-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px;
  background: #f7f7f7;
  border: 1px solid transparent;
  border-radius: 14px;
}

.schedule-option--selected {
  background: #f2f2f2;
  border-color: #dddddd;
}

.schedule-select {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0;
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.checkbox {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 25px;
  height: 25px;
  background: #ffffff;
  border: 1px solid #d6d6d6;
  border-radius: 8px;
  color: #222222;
  font-size: 12px;
  font-weight: 700;
}

.schedule-option--selected
.checkbox {
  background: #222222;
  border-color: #222222;
  color: #ffffff;
}

.schedule-label {
  min-width: 0;
  color: #555555;
  font-size: 12px;
  line-height: 1.5;
}

.primary-select {
  flex: 0 0 auto;
  min-height: 31px;
  padding: 0 9px;
  border: 0;
  background: #ffffff;
  border-radius: 999px;
  color: #888888;
  font-size: 10px;
  cursor: pointer;
}

.primary-select--active {
  background: #222222;
  color: #ffffff;
}

.editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 13px;
}

.editor-footer span {
  color: #999999;
  font-size: 10px;
}

.save-button {
  min-height: 36px;
  padding: 0 13px;
  border: 0;
  background: #222222;
  border-radius: 11px;
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.save-button:disabled {
  opacity: 0.55;
}

.editor-error {
  margin-bottom: 10px;
  padding: 9px 11px;
  background: #fff0f0;
  border-radius: 10px;
  color: #c94343;
  font-size: 11px;
}

.editor-empty {
  padding: 18px;
  background: #f7f7f7;
  border-radius: 13px;
  color: #999999;
  font-size: 11px;
  text-align: center;
}
</style>