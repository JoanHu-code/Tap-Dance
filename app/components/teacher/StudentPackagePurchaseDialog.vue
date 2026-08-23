<script setup>
// ============================================================
// Props
// ============================================================

const props =
  defineProps({
    modelValue: {
      type: Boolean,
      default: false,
    },

    student: {
      type: Object,
      default: null,
    },

    courses: {
      type: Array,
      default: () => [],
    },

    activeCourseIds: {
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
    'submit',
  ])

// ============================================================
// Taipei Today
// ============================================================

const getTaipeiToday =
  () => {
    return new Intl
      .DateTimeFormat(
        'en-CA',
        {
          timeZone:
            'Asia/Taipei',

          year:
            'numeric',

          month:
            '2-digit',

          day:
            '2-digit',
        }
      )
      .format(
        new Date()
      )
  }

// ============================================================
// Form
// ============================================================

const form =
  reactive({
    courseId: '',
    startDate:
      getTaipeiToday(),
    purchasedCycles: 1,
    paid: true,
  })

// ============================================================
// Weekdays
// ============================================================

const weekdayMap = {
  1: '星期一',
  2: '星期二',
  3: '星期三',
  4: '星期四',
  5: '星期五',
  6: '星期六',
  7: '星期日',
}

// ============================================================
// Available Courses
// ============================================================

const availableCourses =
  computed(() => {
    const activeIds =
      new Set(
        props.activeCourseIds.map(
          String
        )
      )

    return props.courses.filter(
      (
        course
      ) => {
        return !activeIds.has(
          String(
            course.id
          )
        )
      }
    )
  })

// ============================================================
// Selected Course
// ============================================================

const selectedCourse =
  computed(() => {
    return (
      props.courses.find(
        (
          course
        ) => {
          return (
            String(
              course.id
            ) ===
            String(
              form.courseId
            )
          )
        }
      ) ||
      null
    )
  })

// ============================================================
// Calculation
// ============================================================

const sessionsPerCycle =
  computed(() => {
    return Number(
      selectedCourse.value
        ?.sessions_per_cycle ||
      0
    )
  })

const pricePerCycle =
  computed(() => {
    return Number(
      selectedCourse.value
        ?.price_per_cycle ||
      0
    )
  })

const normalizedCycles =
  computed(() => {
    const value =
      Number.parseInt(
        String(
          form.purchasedCycles ||
          1
        ),
        10
      )

    return Math.max(
      Number.isFinite(
        value
      )
        ? value
        : 1,
      1
    )
  })

const totalSessions =
  computed(() => {
    return (
      sessionsPerCycle.value *
      normalizedCycles.value
    )
  })

const totalPrice =
  computed(() => {
    return (
      pricePerCycle.value *
      normalizedCycles.value
    )
  })

// ============================================================
// Formatting
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

const formatMoney = (
  value
) => {
  return new Intl
    .NumberFormat(
      'zh-TW',
      {
        maximumFractionDigits:
          0,
      }
    )
    .format(
      Number(
        value || 0
      )
    )
}

// ============================================================
// Reset
// ============================================================

const resetForm =
  () => {
    form.courseId =
      availableCourses.value[0]
        ?.id ||
      ''

    form.startDate =
      getTaipeiToday()

    form.purchasedCycles =
      1

    form.paid =
      true
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
      !form.courseId ||
      !form.startDate ||
      normalizedCycles.value <
        1
    ) {
      return
    }

    emit(
      'submit',
      {
        courseId:
          form.courseId,

        startDate:
          form.startDate,

        purchasedCycles:
          normalizedCycles.value,

        paid:
          form.paid,
      }
    )
  }

// ============================================================
// Watch
// ============================================================

watch(
  () =>
    props.modelValue,
  (
    value
  ) => {
    if (
      value
    ) {
      resetForm()
    }
  }
)

watch(
  availableCourses,
  (
    value
  ) => {
    if (
      props.modelValue &&
      !form.courseId &&
      value.length
    ) {
      form.courseId =
        value[0].id
    }
  }
)
</script>

<template>
  <Teleport to="body">
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
        <!-- ==================================================
             Header
             ================================================== -->

        <header>
          <div>
            <span>
              New Package
            </span>

            <h2>
              建立學生方案
            </h2>

            <p>
              {{
                student?.name ||
                ''
              }}
            </p>
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

        <!-- ==================================================
             No Courses
             ================================================== -->

        <div
          v-if="
            !availableCourses.length
          "
          class="no-course"
        >
          目前沒有可以新增的課堂。可能所有課堂都已有進行中的方案。
        </div>

        <template
          v-else
        >
          <!-- ================================================
               Course
               ================================================ -->

          <label>
            <span>
              課堂
            </span>

            <select
              v-model="
                form.courseId
              "
              :disabled="
                loading
              "
              required
            >
              <option
                v-for="
                  course in
                    availableCourses
                "
                :key="
                  course.id
                "
                :value="
                  course.id
                "
              >
                {{
                  course.name
                }}
                ・
                {{
                  weekdayMap[
                    Number(
                      course.weekday
                    )
                  ]
                }}
                ・
                {{
                  formatTime(
                    course.start_time
                  )
                }}
              </option>
            </select>
          </label>

          <!-- ================================================
               Course Info
               ================================================ -->

          <section
            v-if="
              selectedCourse
            "
            class="course-preview"
          >
            <div>
              <span>
                上課時間
              </span>

              <strong>
                {{
                  weekdayMap[
                    Number(
                      selectedCourse
                        .weekday
                    )
                  ]
                }}

                {{
                  formatTime(
                    selectedCourse
                      .start_time
                  )
                }}
                –
                {{
                  formatTime(
                    selectedCourse
                      .end_time
                  )
                }}
              </strong>
            </div>

            <div>
              <span>
                每期
              </span>

              <strong>
                {{
                  sessionsPerCycle
                }}
                堂
              </strong>
            </div>

            <div>
              <span>
                每期價格
              </span>

              <strong>
                $
                {{
                  formatMoney(
                    pricePerCycle
                  )
                }}
              </strong>
            </div>
          </section>

          <!-- ================================================
               Start Date
               ================================================ -->

          <label>
            <span>
              學生開始日期
            </span>

            <input
              v-model="
                form.startDate
              "
              type="date"
              :disabled="
                loading
              "
              required
            >

            <small>
              這只是方案開始生效的日期，不代表系統會預先計算結束日期。
            </small>
          </label>

          <!-- ================================================
               Purchased Cycles
               ================================================ -->

          <label>
            <span>
              一次購買幾期
            </span>

            <input
              v-model.number="
                form.purchasedCycles
              "
              type="number"
              min="1"
              max="100"
              step="1"
              :disabled="
                loading
              "
              required
            >
          </label>

          <!-- ================================================
               Calculation
               ================================================ -->

          <section class="calculation">
            <span>
              本次方案
            </span>

            <strong>
              {{
                normalizedCycles
              }}
              期
            </strong>

            <div>
              <p>
                {{
                  sessionsPerCycle
                }}
                堂
                ×
                {{
                  normalizedCycles
                }}
                期
              </p>

              <b>
                {{
                  totalSessions
                }}
                堂
              </b>
            </div>

            <div>
              <p>
                $
                {{
                  formatMoney(
                    pricePerCycle
                  )
                }}
                ×
                {{
                  normalizedCycles
                }}
                期
              </p>

              <b>
                $
                {{
                  formatMoney(
                    totalPrice
                  )
                }}
              </b>
            </div>
          </section>

          <!-- ================================================
               Payment
               ================================================ -->

          <label class="paid-field">
            <input
              v-model="
                form.paid
              "
              type="checkbox"
              :disabled="
                loading
              "
            >

            <div>
              <strong>
                已確認付款
              </strong>

              <span>
                目前不串金流，由老師人工確認。
              </span>
            </div>
          </label>

          <!-- ================================================
               Important Rule
               ================================================ -->

          <div class="rule">
            <strong>
              沒有固定結束日期
            </strong>

            <p>
              學生只有實際 ATTENDED 才會累加堂數。學生請假、老師請假或取消都不扣堂；補課實際出席才會增加 1 堂。
            </p>
          </div>
        </template>

        <!-- ==================================================
             Actions
             ================================================== -->

        <footer>
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
            class="confirm-button"
            :disabled="
              loading ||
              !availableCourses.length ||
              !form.courseId ||
              !form.startDate
            "
          >
            {{
              loading
                ? '建立中...'
                : `建立 ${totalSessions} 堂方案`
            }}
          </button>
        </footer>
      </form>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 1500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgb(0 0 0 / 48%);
}

.dialog {
  width: 100%;
  max-width: 520px;
  max-height: calc(100vh - 36px);
  padding: 21px;
  overflow-y: auto;
  background: #ffffff;
  border-radius: 21px;
}

.dialog > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 15px;
}

.dialog header > div > span {
  color: #999999;
  font-size: 8px;
  letter-spacing: 1px;
}

.dialog h2 {
  margin: 4px 0 0;
}

.dialog header p {
  margin: 4px 0 0;
  color: #777777;
  font-size: 9px;
}

.close-button {
  width: 34px;
  height: 34px;
  border: 0;
  background: #eeeeee;
  border-radius: 50%;
}

.dialog > label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 14px;
}

.dialog > label > span {
  color: #666666;
  font-size: 9px;
}

.dialog select,
.dialog input[type='date'],
.dialog input[type='number'] {
  min-height: 41px;
  padding: 0 9px;
  border: 1px solid #dddddd;
  background: #ffffff;
  border-radius: 9px;
}

.dialog small {
  color: #999999;
  font-size: 8px;
  line-height: 1.5;
}

.course-preview {
  display: grid;
  grid-template-columns:
    2fr
    1fr
    1fr;
  gap: 7px;
  margin-top: 10px;
}

.course-preview > div {
  padding: 10px;
  background: #f7f7f7;
  border-radius: 10px;
}

.course-preview span {
  display: block;
  color: #999999;
  font-size: 7px;
}

.course-preview strong {
  display: block;
  margin-top: 4px;
  font-size: 9px;
}

.calculation {
  margin-top: 14px;
  padding: 14px;
  background: #222222;
  border-radius: 14px;
  color: #ffffff;
}

.calculation > span {
  color: rgb(255 255 255 / 50%);
  font-size: 8px;
}

.calculation > strong {
  display: block;
  margin-top: 5px;
  font-size: 18px;
}

.calculation > div {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 9px;
  padding-top: 9px;
  border-top: 1px solid rgb(255 255 255 / 12%);
}

.calculation p {
  margin: 0;
  color: rgb(255 255 255 / 60%);
  font-size: 9px;
}

.calculation b {
  font-size: 10px;
}

.paid-field {
  flex-direction: row !important;
  align-items: center;
  padding: 11px;
  background: #f7f7f7;
  border-radius: 10px;
}

.paid-field input {
  width: 18px;
  height: 18px;
}

.paid-field div {
  display: flex;
  flex-direction: column;
}

.paid-field strong {
  font-size: 9px;
}

.paid-field div span {
  margin-top: 2px;
  color: #999999;
  font-size: 8px;
}

.rule {
  margin-top: 14px;
  padding: 11px;
  background: #fff5df;
  border-radius: 10px;
}

.rule strong {
  color: #856319;
  font-size: 9px;
}

.rule p {
  margin: 5px 0 0;
  color: #8d7541;
  font-size: 8px;
  line-height: 1.6;
}

.no-course {
  margin-top: 14px;
  padding: 20px;
  background: #f7f7f7;
  border-radius: 12px;
  color: #888888;
  font-size: 9px;
  text-align: center;
}

.dialog > footer {
  display: grid;
  grid-template-columns:
    1fr
    1fr;
  gap: 8px;
  margin-top: 18px;
}

.dialog footer button {
  min-height: 42px;
  border: 0;
  background: #eeeeee;
  border-radius: 10px;
}

.dialog footer .confirm-button {
  background: #222222;
  color: #ffffff;
}

button:disabled {
  opacity: 0.45;
}

@media (
  max-width: 480px
) {
  .course-preview {
    grid-template-columns:
      1fr
      1fr;
  }

  .course-preview > div:first-child {
    grid-column:
      1 /
      -1;
  }
}
</style>