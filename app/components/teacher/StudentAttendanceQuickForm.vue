<script setup>
// ============================================================
// Props
// ============================================================

const props =
  defineProps({
    courses: {
      type: Array,
      default: () => [],
    },

    packages: {
      type: Array,
      default: () => [],
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
    packageId:
      '',

    courseId:
      '',

    classDate:
      getTaipeiToday(),

    note:
      '',
  })

// ============================================================
// Weekday
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
// Active Packages
// ============================================================

const activePackages =
  computed(() => {
    return props.packages.filter(
      (
        item
      ) => {
        return (
          item.status ===
            'ACTIVE' &&
          Number(
            item.used_sessions ||
            0
          ) <
          Number(
            item.total_sessions ||
            0
          )
        )
      }
    )
  })

// ============================================================
// Selected Package
// ============================================================

const selectedPackage =
  computed(() => {
    return (
      activePackages.value.find(
        (
          item
        ) => {
          return (
            String(
              item.id
            ) ===
            String(
              form.packageId
            )
          )
        }
      ) ||
      null
    )
  })

// ============================================================
// Same-name course slots
//
// Package 綁的是其中一個 Course ID，
// 但真正可上課時段看 Course Name。
// ============================================================

const availableCourseSlots =
  computed(() => {
    if (
      !selectedPackage.value
    ) {
      return []
    }

    const packageCourseName =
      String(
        selectedPackage.value
          .course_name ||
        ''
      )
        .trim()
        .toLowerCase()

    return props.courses.filter(
      (
        course
      ) => {
        return (
          course.status ===
            'ACTIVE' &&
          String(
            course.name ||
            ''
          )
            .trim()
            .toLowerCase() ===
            packageCourseName
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
      availableCourseSlots.value.find(
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
// Format
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
// Reset Course
// ============================================================

const resetCourseSelection =
  () => {
    form.courseId =
      availableCourseSlots
        .value[0]
        ?.id ||
      ''
  }

// ============================================================
// Package Change
// ============================================================

watch(
  () =>
    form.packageId,
  () => {
    resetCourseSelection()
  }
)

// ============================================================
// Packages Change
// ============================================================

watch(
  activePackages,
  (
    packages
  ) => {
    const currentExists =
      packages.some(
        (
          item
        ) => {
          return (
            String(
              item.id
            ) ===
            String(
              form.packageId
            )
          )
        }
      )

    if (
      !currentExists
    ) {
      form.packageId =
        packages[0]?.id ||
        ''
    }
  },
  {
    immediate: true,
  }
)

// ============================================================
// Submit
// ============================================================

const submit = (
  status
) => {
  if (
    props.saving ||
    !form.packageId ||
    !form.courseId ||
    !form.classDate
  ) {
    return
  }

  emit(
    'submit',
    {
      courseId:
        form.courseId,

      classDate:
        form.classDate,

      status,

      note:
        form.note.trim() ||
        null,
    }
  )
}
</script>

<template>
  <section class="attendance-form">
    <header>
      <div>
        <span>
          Quick Attendance
        </span>

        <h2>
          簽到 / 請假
        </h2>
      </div>
    </header>

    <!-- ======================================================
         No Active Package
         ====================================================== -->

    <div
      v-if="
        !activePackages.length
      "
      class="empty"
    >
      目前沒有可以使用的進行中方案。
    </div>

    <template
      v-else
    >
      <!-- ====================================================
           Package
           ==================================================== -->

      <label>
        <span>
          要扣哪個課程方案
        </span>

        <select
          v-model="
            form.packageId
          "
          :disabled="
            saving
          "
        >
          <option
            v-for="
              packageData in
                activePackages
            "
            :key="
              packageData.id
            "
            :value="
              packageData.id
            "
          >
            {{
              packageData.course_name
            }}
            ・
            {{
              packageData.used_sessions
            }}
            /
            {{
              packageData.total_sessions
            }}
            堂
          </option>
        </select>
      </label>

      <!-- ====================================================
           Actual Class Slot
           ==================================================== -->

      <label>
        <span>
          今天實際上哪個時段
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
                availableCourseSlots
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
            –
            {{
              formatTime(
                course.end_time
              )
            }}
          </option>
        </select>
      </label>

      <!-- ====================================================
           Selected
           ==================================================== -->

      <div
        v-if="
          selectedPackage &&
          selectedCourse
        "
        class="selected-info"
      >
        <div>
          <span>
            方案
          </span>

          <strong>
            {{
              selectedPackage
                .course_name
            }}
          </strong>
        </div>

        <div>
          <span>
            目前
          </span>

          <strong>
            {{
              selectedPackage
                .used_sessions
            }}
            /
            {{
              selectedPackage
                .total_sessions
            }}
          </strong>
        </div>

        <div>
          <span>
            實際時段
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
          </strong>
        </div>
      </div>

      <!-- ====================================================
           Date
           ==================================================== -->

      <label>
        <span>
          日期
        </span>

        <input
          v-model="
            form.classDate
          "
          type="date"
          :disabled="
            saving
          "
        >
      </label>

      <!-- ====================================================
           Note
           ==================================================== -->

      <label>
        <span>
          備註
        </span>

        <input
          v-model="
            form.note
          "
          type="text"
          maxlength="2000"
          placeholder="選填"
          :disabled="
            saving
          "
        >
      </label>

      <!-- ====================================================
           Actions
           ==================================================== -->

      <div class="actions">
        <button
          type="button"
          class="attended"
          :disabled="
            saving ||
            !form.courseId ||
            !form.classDate
          "
          @click="
            submit(
              'ATTENDED'
            )
          "
        >
          {{
            saving
              ? '處理中...'
              : '✓ 簽到'
          }}
        </button>

        <button
          type="button"
          class="leave"
          :disabled="
            saving ||
            !form.courseId ||
            !form.classDate
          "
          @click="
            submit(
              'LEAVE'
            )
          "
        >
          {{
            saving
              ? '處理中...'
              : '請假'
          }}
        </button>
      </div>

      <p class="rule">
        簽到會累加 1 堂；請假不扣堂。若學生到其他同名課堂上課，直接選那個時段簽到即可，不需要另外建立補課紀錄。
      </p>
    </template>
  </section>
</template>

<style scoped>
.attendance-form {
  padding: 16px;
  background: #ffffff;
  border-radius: 16px;
}

.attendance-form header span {
  color: #999999;
  font-size: 8px;
  letter-spacing: 1px;
}

.attendance-form h2 {
  margin: 3px 0 0;
  font-size: 17px;
}

.attendance-form label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 11px;
}

.attendance-form label > span {
  color: #777777;
  font-size: 8px;
}

.attendance-form select,
.attendance-form input {
  width: 100%;
  min-height: 39px;
  padding: 0 9px;
  border: 1px solid #dddddd;
  background: #ffffff;
  border-radius: 9px;
  font-size: 9px;
}

.selected-info {
  display: grid;
  grid-template-columns:
    repeat(
      3,
      1fr
    );
  gap: 6px;
  margin-top: 9px;
}

.selected-info > div {
  padding: 9px;
  background: #f7f7f7;
  border-radius: 9px;
}

.selected-info span {
  display: block;
  color: #999999;
  font-size: 7px;
}

.selected-info strong {
  display: block;
  margin-top: 4px;
  font-size: 9px;
}

.actions {
  display: grid;
  grid-template-columns:
    2fr
    1fr;
  gap: 7px;
  margin-top: 13px;
}

.actions button {
  min-height: 43px;
  border: 0;
  border-radius: 10px;
  font-size: 10px;
}

.actions .attended {
  background: #222222;
  color: #ffffff;
}

.actions .leave {
  background: #fff5df;
  color: #856319;
}

.rule {
  margin: 9px 0 0;
  color: #999999;
  font-size: 7px;
  line-height: 1.6;
}

.empty {
  margin-top: 10px;
  padding: 20px;
  background: #f7f7f7;
  border-radius: 11px;
  color: #999999;
  font-size: 9px;
  text-align: center;
}

button:disabled {
  opacity: 0.4;
}

@media (
  max-width: 500px
) {
  .selected-info {
    grid-template-columns:
      1fr
      1fr;
  }

  .selected-info > div:last-child {
    grid-column:
      1 /
      -1;
  }
}
</style>