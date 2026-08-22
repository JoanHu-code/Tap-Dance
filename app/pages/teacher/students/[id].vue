<script setup>
definePageMeta({
  middleware:
    'teacher-auth',
})

const route =
  useRoute()

const studentId =
  computed(() => {
    return String(
      route.params.id ||
      ''
    )
  })

const loading =
  ref(true)

const saving =
  ref(false)

const enrollmentSaving =
  ref(false)

const errorMessage =
  ref('')

const successMessage =
  ref('')

const student =
  ref(null)

const enrollments =
  ref([])

const packages =
  ref([])

const attendanceRecords =
  ref([])

const availableCourses =
  ref([])

const availableSchedules =
  ref([])

const showEditDialog =
  ref(false)

const showEnrollmentDialog =
  ref(false)

const editForm =
  reactive({
    name: '',
  })

const enrollmentForm =
  reactive({
    courseId: '',
    scheduleId: '',
  })

let toastTimer =
  null

// ============================================================
// Name
// ============================================================

const studentName =
  computed(() => {
    return (
      student.value
        ?.name ||
      `學生 #${studentId.value}`
    )
  })

// ============================================================
// LINE
// ============================================================

const isLineLinked =
  computed(() => {
    return Boolean(
      student.value
        ?.user_id
    )
  })

// ============================================================
// Weekday
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
      ''
    )
  }

// ============================================================
// Money
// ============================================================

const formatMoney =
  (
    value
  ) => {
    return new Intl
      .NumberFormat(
        'zh-TW'
      )
      .format(
        Number(
          value || 0
        )
      )
  }

// ============================================================
// Toast
// ============================================================

const showToast =
  (
    text
  ) => {
    successMessage.value =
      text

    if (
      toastTimer
    ) {
      window.clearTimeout(
        toastTimer
      )
    }

    toastTimer =
      window.setTimeout(
        () => {
          successMessage.value =
            ''
        },
        2400
      )
  }

// ============================================================
// Fetch
// ============================================================

const fetchStudent =
  async () => {
    loading.value =
      true

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          `/api/teacher/students/${studentId.value}`
        )

      student.value =
        response.student ||
        null

      enrollments.value =
        response.enrollments ||
        []

      packages.value =
        response.packages ||
        []

      attendanceRecords.value =
        response
          .attendanceRecords ||
        []

      availableCourses.value =
        response
          .availableCourses ||
        []

      availableSchedules.value =
        response
          .availableSchedules ||
        []
    } catch (error) {
      console.error(
        '學生詳情載入失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        '學生資料載入失敗'
    } finally {
      loading.value =
        false
    }
  }

// ============================================================
// Edit Student
// ============================================================

const openEditDialog =
  () => {
    editForm.name =
      student.value
        ?.name ||
      ''

    showEditDialog.value =
      true
  }

const saveStudent =
  async () => {
    const name =
      editForm.name
        .trim()

    if (!name) {
      errorMessage.value =
        '請輸入學生姓名'

      return
    }

    saving.value =
      true

    try {
      await $fetch(
        `/api/teacher/students/${studentId.value}`,
        {
          method:
            'PATCH',

          body: {
            name,
          },
        }
      )

      showEditDialog.value =
        false

      showToast(
        '學生資料更新成功'
      )

      await fetchStudent()
    } catch (error) {
      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.message ||
        '更新失敗'
    } finally {
      saving.value =
        false
    }
  }

// ============================================================
// Course Schedules
// ============================================================

const selectedCourseSchedules =
  computed(() => {
    if (
      !enrollmentForm
        .courseId
    ) {
      return []
    }

    return availableSchedules.value
      .filter(
        (
          schedule
        ) => {
          return (
            String(
              schedule.course_id
            ) ===
            String(
              enrollmentForm
                .courseId
            )
          )
        }
      )
  })

// ============================================================
// Create Enrollment
//
// 目前第一次建立仍先指定一個 Primary。
// 建完之後即可使用下面多 Schedule Editor
// 加入第二、第三個固定時段。
// ============================================================

const createEnrollment =
  async () => {
    if (
      enrollmentSaving.value
    ) {
      return
    }

    if (
      !enrollmentForm
        .courseId
    ) {
      return
    }

    enrollmentSaving.value =
      true

    try {
      await $fetch(
        `/api/teacher/students/${studentId.value}/enrollments`,
        {
          method:
            'POST',

          body: {
            courseId:
              enrollmentForm
                .courseId,

            scheduleId:
              enrollmentForm
                .scheduleId ||
              null,
          },
        }
      )

      showEnrollmentDialog.value =
        false

      showToast(
        '學生已加入課程'
      )

      await fetchStudent()
    } catch (error) {
      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.message ||
        '加入課程失敗'
    } finally {
      enrollmentSaving.value =
        false
    }
  }

// ============================================================
// Schedule Updated
// ============================================================

const handleSchedulesUpdated =
  async () => {
    showToast(
      '固定班別已更新'
    )

    await fetchStudent()
  }

// ============================================================
// Package for Course
// ============================================================

const getLatestPackage =
  (
    courseId
  ) => {
    return (
      packages.value.find(
        (
          item
        ) => {
          return (
            String(
              item.course_id
            ) ===
            String(
              courseId
            )
          )
        }
      ) ||
      null
    )
  }

// ============================================================
// Mounted
// ============================================================

onMounted(
  async () => {
    await fetchStudent()
  }
)

onBeforeUnmount(
  () => {
    if (
      toastTimer
    ) {
      window.clearTimeout(
        toastTimer
      )
    }
  }
)
</script>

<template>
  <main
    class="
      student-detail-page
    "
  >
    <div
      class="
        container
      "
    >
      <div
        v-if="
          loading
        "
        class="
          loading-page
        "
      >
        <div
          class="
            loader
          "
        />

        <span>
          載入學生資料
        </span>
      </div>

      <template
        v-else-if="
          student
        "
      >
        <header
          class="
            header
          "
        >
          <div>
            <NuxtLink
              to="
                /teacher/students
              "
              class="
                back-link
              "
            >
              ← 學生列表
            </NuxtLink>

            <span
              class="
                eyebrow
              "
            >
              Student
            </span>

            <h1>
              {{
                studentName
              }}
            </h1>

            <p>
              課程、固定班別、Package 與歷史紀錄
            </p>
          </div>

          <button
            type="button"
            class="
              black-button
            "
            @click="
              openEditDialog
            "
          >
            編輯姓名
          </button>
        </header>

        <div
          v-if="
            errorMessage
          "
          class="
            error-message
          "
        >
          {{
            errorMessage
          }}
        </div>

        <!-- ==================================================
             Overview
             ================================================== -->

        <section
          class="
            overview-grid
          "
        >
          <article>
            <span>
              課程
            </span>

            <strong>
              {{
                enrollments.length
              }}
            </strong>
          </article>

          <article>
            <span>
              Package
            </span>

            <strong>
              {{
                packages.length
              }}
            </strong>
          </article>

          <article>
            <span>
              LINE
            </span>

            <strong
              class="
                small-status
              "
            >
              {{
                isLineLinked
                  ? '已綁定'
                  : '未綁定'
              }}
            </strong>
          </article>
        </section>

        <!-- ==================================================
             Enrollments
             ================================================== -->

        <section
          class="
            main-panel
          "
        >
          <div
            class="
              panel-header
            "
          >
            <div>
              <span>
                Enrollment
              </span>

              <h2>
                學生課程與固定班別
              </h2>
            </div>

            <button
              type="button"
              class="
                black-button
                small
              "
              @click="
                showEnrollmentDialog =
                  true
              "
            >
              ＋ 加入課程
            </button>
          </div>

          <div
            v-if="
              enrollments.length
            "
            class="
              enrollment-list
            "
          >
            <article
              v-for="
                enrollment in
                  enrollments
              "
              :key="
                enrollment.id
              "
              class="
                enrollment-card
              "
            >
              <div
                class="
                  enrollment-heading
                "
              >
                <div>
                  <span>
                    Course
                  </span>

                  <h3>
                    {{
                      enrollment
                        .course_name
                    }}
                  </h3>
                </div>

                <span
                  class="
                    status-pill
                  "
                >
                  {{
                    enrollment.status
                  }}
                </span>
              </div>

              <!-- ============================================
                   Current Schedules
                   ============================================ -->

              <div
                class="
                  current-schedules
                "
              >
                <span
                  class="
                    subsection-title
                  "
                >
                  目前固定班別
                </span>

                <div
                  v-if="
                    enrollment
                      .schedules
                      ?.length
                  "
                  class="
                    schedule-chips
                  "
                >
                  <span
                    v-for="
                      schedule in
                        enrollment
                          .schedules
                    "
                    :key="
                      schedule.schedule_id
                    "
                    class="
                      schedule-chip
                    "
                    :class="{
                      'schedule-chip--primary':
                        schedule.is_primary,
                    }"
                  >
                    {{
                      getWeekdayLabel(
                        schedule.weekday
                      )
                    }}

                    {{
                      String(
                        schedule.start_time ||
                        ''
                      )
                        .slice(
                          0,
                          5
                        )
                    }}

                    <small
                      v-if="
                        schedule.is_primary
                      "
                    >
                      主要
                    </small>
                  </span>
                </div>

                <span
                  v-else
                  class="
                    no-schedule
                  "
                >
                  尚未設定固定時段
                </span>
              </div>

              <!-- ============================================
                   Editor
                   ============================================ -->

              <EnrollmentScheduleEditor
                :enrollment="
                  enrollment
                "
                :available-schedules="
                  availableSchedules
                "
                :student-id="
                  studentId
                "
                @updated="
                  handleSchedulesUpdated
                "
              />

              <!-- ============================================
                   Package
                   ============================================ -->

              <div
                v-if="
                  getLatestPackage(
                    enrollment
                      .course_id
                  )
                "
                class="
                  package-summary
                "
              >
                <div>
                  <span>
                    Package
                  </span>

                  <strong>
                    第
                    {{
                      getLatestPackage(
                        enrollment
                          .course_id
                      )
                        .cycle_no ||
                      1
                    }}
                    期
                  </strong>
                </div>

                <div>
                  <span>
                    堂數
                  </span>

                  <strong>
                    {{
                      getLatestPackage(
                        enrollment
                          .course_id
                      )
                        .attended_count ||
                      0
                    }}
                    /
                    {{
                      getLatestPackage(
                        enrollment
                          .course_id
                      )
                        .total_sessions
                    }}
                  </strong>
                </div>

                <div>
                  <span>
                    價格
                  </span>

                  <strong>
                    NT$
                    {{
                      formatMoney(
                        getLatestPackage(
                          enrollment
                            .course_id
                        )
                          .price
                      )
                    }}
                  </strong>
                </div>
              </div>
            </article>
          </div>

          <div
            v-else
            class="
              empty-state
            "
          >
            尚未加入任何課程
          </div>
        </section>
      </template>
    </div>

    <!-- ======================================================
         Edit Dialog
         ====================================================== -->

    <Teleport
      to="body"
    >
      <div
        v-if="
          showEditDialog
        "
        class="
          dialog-mask
        "
        @click.self="
          showEditDialog =
            false
        "
      >
        <form
          class="
            dialog
          "
          @submit.prevent="
            saveStudent
          "
        >
          <h2>
            修改學生姓名
          </h2>

          <label>
            姓名
          </label>

          <input
            v-model="
              editForm.name
            "
            type="text"
            maxlength="100"
          >

          <div
            class="
              dialog-actions
            "
          >
            <button
              type="button"
              @click="
                showEditDialog =
                  false
              "
            >
              取消
            </button>

            <button
              type="submit"
              class="
                confirm
              "
              :disabled="
                saving
              "
            >
              {{
                saving
                  ? '儲存中...'
                  : '儲存'
              }}
            </button>
          </div>
        </form>
      </div>

      <!-- ====================================================
           Enrollment Dialog
           ==================================================== -->

      <div
        v-if="
          showEnrollmentDialog
        "
        class="
          dialog-mask
        "
        @click.self="
          showEnrollmentDialog =
            false
        "
      >
        <form
          class="
            dialog
          "
          @submit.prevent="
            createEnrollment
          "
        >
          <h2>
            加入課程
          </h2>

          <label>
            課程
          </label>

          <select
            v-model="
              enrollmentForm
                .courseId
            "
            @change="
              enrollmentForm
                .scheduleId =
                  ''
            "
          >
            <option
              value=""
            >
              請選擇
            </option>

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
            </option>
          </select>

          <label>
            主要班別
          </label>

          <select
            v-model="
              enrollmentForm
                .scheduleId
            "
            :disabled="
              !enrollmentForm
                .courseId
            "
          >
            <option
              value=""
            >
              暫不指定
            </option>

            <option
              v-for="
                schedule in
                  selectedCourseSchedules
              "
              :key="
                schedule.id
              "
              :value="
                schedule.id
              "
            >
              {{
                getWeekdayLabel(
                  schedule.weekday
                )
              }}

              {{
                String(
                  schedule.start_time ||
                  ''
                )
                  .slice(
                    0,
                    5
                  )
              }}
            </option>
          </select>

          <small
            class="
              form-hint
            "
          >
            建立後可以再選擇第二、第三個固定時段。
          </small>

          <div
            class="
              dialog-actions
            "
          >
            <button
              type="button"
              @click="
                showEnrollmentDialog =
                  false
              "
            >
              取消
            </button>

            <button
              type="submit"
              class="
                confirm
              "
              :disabled="
                enrollmentSaving ||
                !enrollmentForm
                  .courseId
              "
            >
              {{
                enrollmentSaving
                  ? '建立中...'
                  : '加入課程'
              }}
            </button>
          </div>
        </form>
      </div>
    </Teleport>

    <Transition
      name="
        toast
      "
    >
      <div
        v-if="
          successMessage
        "
        class="
          toast
        "
      >
        {{
          successMessage
        }}
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.student-detail-page {
  min-height: 100vh;
  padding:
    27px
    18px
    60px;
  background: #f6f6f6;
  color: #222222;
}

.container {
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
}

.header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}

.back-link {
  display: block;
  margin-bottom: 16px;
  color: #777777;
  font-size: 11px;
  text-decoration: none;
}

.eyebrow,
.panel-header span,
.enrollment-heading span,
.package-summary span,
.subsection-title {
  color: #999999;
  font-size: 10px;
  letter-spacing: 0.8px;
}

.header h1 {
  margin: 4px 0 0;
  font-size: 27px;
}

.header p {
  margin: 6px 0 0;
  color: #888888;
  font-size: 12px;
}

.black-button {
  min-height: 42px;
  padding:
    0
    15px;
  border: 0;
  background: #222222;
  border-radius: 13px;
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.black-button.small {
  min-height: 36px;
}

/* ============================================================
   Overview
   ============================================================ */

.overview-grid {
  display: grid;
  grid-template-columns:
    repeat(
      3,
      minmax(0, 1fr)
    );
  gap: 13px;
  margin-top: 22px;
}

.overview-grid article {
  display: flex;
  flex-direction: column;
  min-height: 104px;
  padding: 17px;
  background: #ffffff;
  border-radius: 19px;
}

.overview-grid span {
  color: #999999;
  font-size: 10px;
}

.overview-grid strong {
  margin-top: auto;
  font-size: 26px;
}

.small-status {
  font-size: 17px !important;
}

/* ============================================================
   Main Panel
   ============================================================ */

.main-panel {
  margin-top: 17px;
  padding: 21px;
  background: #ffffff;
  border-radius: 23px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-header h2 {
  margin: 4px 0 0;
  font-size: 18px;
}

/* ============================================================
   Enrollment
   ============================================================ */

.enrollment-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 17px;
}

.enrollment-card {
  padding: 17px;
  border: 1px solid #eeeeee;
  border-radius: 18px;
}

.enrollment-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.enrollment-heading h3 {
  margin: 4px 0 0;
  font-size: 16px;
}

.status-pill {
  padding:
    5px
    8px;
  background: #f3f3f3;
  border-radius: 999px;
  font-size: 9px !important;
}

.current-schedules {
  margin-top: 14px;
}

.schedule-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 8px;
}

.schedule-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding:
    6px
    9px;
  background: #f4f4f4;
  border-radius: 999px;
  color: #666666;
  font-size: 10px;
}

.schedule-chip--primary {
  background: #222222;
  color: #ffffff;
}

.schedule-chip small {
  opacity: 0.65;
}

.no-schedule {
  display: block;
  margin-top: 7px;
  color: #aaaaaa;
  font-size: 10px;
}

/* ============================================================
   Package
   ============================================================ */

.package-summary {
  display: grid;
  grid-template-columns:
    repeat(
      3,
      minmax(0, 1fr)
    );
  gap: 9px;
  margin-top: 15px;
  padding: 13px;
  background: #f7f7f7;
  border-radius: 13px;
}

.package-summary >
div {
  display: flex;
  flex-direction: column;
}

.package-summary strong {
  margin-top: 4px;
  font-size: 11px;
}

/* ============================================================
   Dialog
   ============================================================ */

.dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background:
    rgb(0 0 0 / 45%);
}

.dialog {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 410px;
  padding: 23px;
  background: #ffffff;
  border-radius: 22px;
}

.dialog h2 {
  margin: 0 0 18px;
}

.dialog label {
  margin:
    13px
    0
    6px;
  font-size: 11px;
  font-weight: 600;
}

.dialog input,
.dialog select {
  height: 44px;
  padding:
    0
    11px;
  border: 1px solid #dddddd;
  border-radius: 12px;
}

.form-hint {
  margin-top: 7px;
  color: #999999;
  font-size: 10px;
}

.dialog-actions {
  display: grid;
  grid-template-columns:
    1fr 1fr;
  gap: 9px;
  margin-top: 22px;
}

.dialog-actions button {
  min-height: 43px;
  border: 0;
  background: #eeeeee;
  border-radius: 12px;
}

.dialog-actions .confirm {
  background: #222222;
  color: #ffffff;
}

/* ============================================================
   Utility
   ============================================================ */

.error-message {
  margin-top: 13px;
  padding: 11px;
  background: #fff0f0;
  border-radius: 11px;
  color: #c94343;
  font-size: 11px;
}

.empty-state {
  padding: 30px;
  color: #aaaaaa;
  text-align: center;
}

.loading-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.loader {
  width: 39px;
  height: 39px;
  margin-bottom: 13px;
  border: 4px solid #eeeeee;
  border-top-color: #222222;
  border-radius: 50%;
  animation:
    loading
    0.75s
    linear infinite;
}

.toast {
  position: fixed;
  bottom: 27px;
  left: 50%;
  z-index: 1100;
  padding:
    10px
    18px;
  background: #222222;
  border-radius: 999px;
  color: #ffffff;
  font-size: 11px;
  transform:
    translateX(-50%);
}

@keyframes loading {
  to {
    transform:
      rotate(360deg);
  }
}

@media (
  max-width: 650px
) {
  .overview-grid {
    grid-template-columns:
      repeat(
        3,
        1fr
      );
  }

  .package-summary {
    grid-template-columns:
      1fr;
  }

  .header >
  .black-button {
    display: none;
  }
}
</style>