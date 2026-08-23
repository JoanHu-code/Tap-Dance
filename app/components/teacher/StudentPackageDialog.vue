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

    courses: {
      type: Array,
      default: () => [],
    },

    packageData: {
      type: Object,
      default: null,
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
// Mode
// ============================================================

const isRenew =
  computed(() => {
    return Boolean(
      props.packageData?.id
    )
  })

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
// Selected Course
// ============================================================

const selectedCourse =
  computed(() => {
    return (
      props.courses.find(
        (
          item
        ) => {
          return (
            String(
              item.id
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

const cycles =
  computed(() => {
    const parsed =
      Number.parseInt(
        String(
          form.purchasedCycles ||
          1
        ),
        10
      )

    return Math.max(
      Number.isInteger(
        parsed
      )
        ? parsed
        : 1,
      1
    )
  })

const sessionsPerCycle =
  computed(() => {
    if (
      isRenew.value &&
      !selectedCourse.value
    ) {
      return Number(
        props.packageData
          ?.sessions_per_cycle ||
        0
      )
    }

    return Number(
      selectedCourse.value
        ?.sessions_per_cycle ||
      0
    )
  })

const pricePerCycle =
  computed(() => {
    if (
      isRenew.value &&
      !selectedCourse.value
    ) {
      return Number(
        props.packageData
          ?.price_per_cycle ||
        0
      )
    }

    return Number(
      selectedCourse.value
        ?.price_per_cycle ||
      0
    )
  })

const totalSessions =
  computed(() => {
    return (
      sessionsPerCycle.value *
      cycles.value
    )
  })

const totalPrice =
  computed(() => {
    return (
      pricePerCycle.value *
      cycles.value
    )
  })

// ============================================================
// Format
// ============================================================

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

const reset =
  () => {
    form.startDate =
      getTaipeiToday()

    form.purchasedCycles =
      1

    form.paid =
      true

    if (
      isRenew.value
    ) {
      form.courseId =
        props.packageData
          ?.course_id ||
        ''
    } else {
      form.courseId =
        props.courses.find(
          (
            item
          ) =>
            item.status ===
            'ACTIVE'
        )?.id ||
        ''
    }
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
      reset()
    }
  }
)

// ============================================================
// Close
// ============================================================

const close =
  () => {
    if (
      props.saving
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
      props.saving ||
      !form.startDate ||
      cycles.value <=
        0
    ) {
      return
    }

    if (
      isRenew.value
    ) {
      emit(
        'submit',
        {
          action:
            'RESET_PACKAGE',

          packageId:
            props.packageData.id,

          startDate:
            form.startDate,

          purchasedCycles:
            cycles.value,

          paid:
            form.paid,
        }
      )

      return
    }

    if (
      !form.courseId
    ) {
      return
    }

    emit(
      'submit',
      {
        action:
          'CREATE_PACKAGE',

        courseId:
          form.courseId,

        startDate:
          form.startDate,

        purchasedCycles:
          cycles.value,

        paid:
          form.paid,
      }
    )
  }
</script>

<template>
  <Teleport to="body">
    <div
      v-if="
        modelValue
      "
      class="mask"
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
              {{
                isRenew
                  ? 'Next Round'
                  : 'New Package'
              }}
            </span>

            <h2>
              {{
                isRenew
                  ? '開始下一輪'
                  : '建立課程方案'
              }}
            </h2>
          </div>

          <button
            type="button"
            :disabled="
              saving
            "
            @click="
              close
            "
          >
            ×
          </button>
        </header>

        <!-- ==================================================
             Course
             ================================================== -->

        <label
          v-if="
            !isRenew
          "
        >
          <span>
            主要課堂
          </span>

          <select
            v-model="
              form.courseId
            "
            :disabled="
              saving
            "
          >
            <option
              v-for="
                course in
                  courses.filter(
                    item =>
                      item.status ===
                      'ACTIVE'
                  )
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
                {
                  1: '星期一',
                  2: '星期二',
                  3: '星期三',
                  4: '星期四',
                  5: '星期五',
                  6: '星期六',
                  7: '星期日',
                }[
                  Number(
                    course.weekday
                  )
                ]
              }}
              ・
              {{
                String(
                  course.start_time ||
                  ''
                ).slice(
                  0,
                  5
                )
              }}
            </option>
          </select>
        </label>

        <div
          v-else
          class="course-name"
        >
          <span>
            課程
          </span>

          <strong>
            {{
              packageData
                ?.course_name
            }}
          </strong>
        </div>

        <!-- ==================================================
             Start Date
             ================================================== -->

        <label>
          <span>
            新一輪開始日期
          </span>

          <input
            v-model="
              form.startDate
            "
            type="date"
            required
            :disabled="
              saving
            "
          >
        </label>

        <!-- ==================================================
             Cycles
             ================================================== -->

        <label>
          <span>
            購買幾期
          </span>

          <input
            v-model.number="
              form.purchasedCycles
            "
            type="number"
            min="1"
            max="100"
            step="1"
            required
            :disabled="
              saving
            "
          >
        </label>

        <!-- ==================================================
             Fast Choices
             ================================================== -->

        <div class="cycle-buttons">
          <button
            v-for="
              count in [
                1,
                2,
                3,
              ]
            "
            :key="
              count
            "
            type="button"
            :class="{
              selected:
                cycles ===
                count,
            }"
            @click="
              form.purchasedCycles =
                count
            "
          >
            {{
              count
            }}
            期
          </button>
        </div>

        <!-- ==================================================
             Preview
             ================================================== -->

        <section class="preview">
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
              購買
            </span>

            <strong>
              {{
                cycles
              }}
              期
            </strong>
          </div>

          <div>
            <span>
              新總堂數
            </span>

            <strong>
              {{
                totalSessions
              }}
              堂
            </strong>
          </div>

          <div>
            <span>
              金額
            </span>

            <strong>
              $
              {{
                formatMoney(
                  totalPrice
                )
              }}
            </strong>
          </div>
        </section>

        <!-- ==================================================
             Paid
             ================================================== -->

        <label class="paid">
          <input
            v-model="
              form.paid
            "
            type="checkbox"
            :disabled="
              saving
            "
          >

          <div>
            <strong>
              已付款
            </strong>

            <span>
              由老師人工確認
            </span>
          </div>
        </label>

        <!-- ==================================================
             Rule
             ================================================== -->

        <div class="rule">
          {{
            isRenew
              ? '舊一輪紀錄會完整保留，不會清空。新的堂數會從 0 重新累積。'
              : '堂數不依日期自動結束，只依實際簽到累積。'
          }}
        </div>

        <!-- ==================================================
             Footer
             ================================================== -->

        <footer>
          <button
            type="button"
            :disabled="
              saving
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
              saving ||
              (
                !isRenew &&
                !form.courseId
              )
            "
          >
            {{
              saving
                ? '儲存中...'
                : isRenew
                  ? `開始 ${totalSessions} 堂新一輪`
                  : `建立 ${totalSessions} 堂方案`
            }}
          </button>
        </footer>
      </form>
    </div>
  </Teleport>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 1600;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 17px;
  background: rgb(0 0 0 / 48%);
}

.dialog {
  width: 100%;
  max-width: 480px;
  max-height: calc(100vh - 34px);
  overflow-y: auto;
  padding: 19px;
  background: #ffffff;
  border-radius: 19px;
}

.dialog > header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.dialog header span {
  color: #999999;
  font-size: 8px;
  letter-spacing: 1px;
}

.dialog h2 {
  margin: 3px 0 0;
}

.dialog header button {
  width: 33px;
  height: 33px;
  border: 0;
  background: #eeeeee;
  border-radius: 50%;
}

.dialog > label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 12px;
}

.dialog label > span,
.course-name span {
  color: #777777;
  font-size: 8px;
}

.dialog select,
.dialog input[type='date'],
.dialog input[type='number'] {
  width: 100%;
  min-height: 39px;
  padding: 0 9px;
  border: 1px solid #dddddd;
  background: #ffffff;
  border-radius: 9px;
}

.course-name {
  margin-top: 12px;
  padding: 11px;
  background: #f7f7f7;
  border-radius: 10px;
}

.course-name strong {
  display: block;
  margin-top: 4px;
}

.cycle-buttons {
  display: grid;
  grid-template-columns:
    repeat(
      3,
      1fr
    );
  gap: 6px;
  margin-top: 8px;
}

.cycle-buttons button {
  min-height: 34px;
  border: 0;
  background: #eeeeee;
  border-radius: 8px;
  color: #666666;
  font-size: 8px;
}

.cycle-buttons button.selected {
  background: #222222;
  color: #ffffff;
}

.preview {
  display: grid;
  grid-template-columns:
    1fr
    1fr;
  gap: 6px;
  margin-top: 12px;
  padding: 11px;
  background: #222222;
  border-radius: 11px;
}

.preview > div {
  padding: 7px;
  background: rgb(255 255 255 / 8%);
  border-radius: 7px;
}

.preview span {
  display: block;
  color: rgb(255 255 255 / 50%);
  font-size: 7px;
}

.preview strong {
  display: block;
  margin-top: 3px;
  color: #ffffff;
  font-size: 10px;
}

.paid {
  flex-direction: row !important;
  align-items: center;
  padding: 10px;
  background: #f7f7f7;
  border-radius: 9px;
}

.paid input {
  width: 18px;
  height: 18px;
}

.paid div {
  display: flex;
  flex-direction: column;
}

.paid strong {
  font-size: 9px;
}

.paid div span {
  margin-top: 2px;
  color: #999999;
  font-size: 7px;
}

.rule {
  margin-top: 10px;
  padding: 9px;
  background: #fff5df;
  border-radius: 8px;
  color: #856319;
  font-size: 8px;
  line-height: 1.5;
}

.dialog footer {
  display: grid;
  grid-template-columns:
    1fr
    2fr;
  gap: 7px;
  margin-top: 15px;
}

.dialog footer button {
  min-height: 40px;
  border: 0;
  background: #eeeeee;
  border-radius: 9px;
}

.dialog footer .confirm {
  background: #222222;
  color: #ffffff;
}

button:disabled {
  opacity: 0.4;
}
</style>