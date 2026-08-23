<script setup>
definePageMeta({
  middleware: 'teacher-auth',
})

// ============================================================
// State
// ============================================================

const loading = ref(true)
const saving = ref(false)

const errorMessage = ref('')
const successMessage = ref('')

const courses = ref([])

const showDialog = ref(false)
const editingCourseId = ref(null)

// ============================================================
// Form
// ============================================================

const form = reactive({
  name: '',
  weekday: 6,
  startTime: '12:00',
  endTime: '13:00',
  sessionsPerCycle: 8,
  pricePerCycle: 3600,
})

// ============================================================
// Weekday
// ============================================================

const weekdays = [
  {
    value: 1,
    label: '星期一',
  },
  {
    value: 2,
    label: '星期二',
  },
  {
    value: 3,
    label: '星期三',
  },
  {
    value: 4,
    label: '星期四',
  },
  {
    value: 5,
    label: '星期五',
  },
  {
    value: 6,
    label: '星期六',
  },
  {
    value: 7,
    label: '星期日',
  },
]

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
// Active / Inactive
// ============================================================

const activeCourses = computed(() => {
  return courses.value.filter((course) => {
    return course.status === 'ACTIVE'
  })
})

const inactiveCourses = computed(() => {
  return courses.value.filter((course) => {
    return course.status === 'INACTIVE'
  })
})

// ============================================================
// Format
// ============================================================

const formatTime = (value) => {
  return String(value || '').slice(0, 5)
}

const formatMoney = (value) => {
  return new Intl.NumberFormat(
    'zh-TW',
    {
      maximumFractionDigits: 0,
    },
  ).format(
    Number(value || 0),
  )
}

// ============================================================
// Error
// ============================================================

const getErrorMessage = (
  error,
  fallback,
) => {
  return (
    error?.data?.statusMessage ||
    error?.statusMessage ||
    error?.message ||
    fallback
  )
}

// ============================================================
// Load
// ============================================================

const loadCourses = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await $fetch(
      '/api/teacher/courses',
    )

    courses.value =
      response.courses || []
  }
  catch (error) {
    console.error(
      '課堂載入失敗：',
      error,
    )

    errorMessage.value =
      getErrorMessage(
        error,
        '課堂資料載入失敗',
      )
  }
  finally {
    loading.value = false
  }
}

// ============================================================
// Reset Form
// ============================================================

const resetForm = () => {
  editingCourseId.value = null

  form.name = ''
  form.weekday = 6
  form.startTime = '12:00'
  form.endTime = '13:00'
  form.sessionsPerCycle = 8
  form.pricePerCycle = 3600
}

// ============================================================
// Open New
// ============================================================

const openCreate = () => {
  resetForm()
  showDialog.value = true
}

// ============================================================
// Open Edit
// ============================================================

const openEdit = (course) => {
  editingCourseId.value =
    course.id

  form.name =
    course.name || ''

  form.weekday =
    Number(
      course.weekday || 1,
    )

  form.startTime =
    formatTime(
      course.start_time,
    )

  form.endTime =
    formatTime(
      course.end_time,
    )

  form.sessionsPerCycle =
    Number(
      course.sessions_per_cycle ||
      1,
    )

  form.pricePerCycle =
    Number(
      course.price_per_cycle ||
      0,
    )

  showDialog.value = true
}

// ============================================================
// Validate
// ============================================================

const validateForm = () => {
  if (
    !form.name.trim()
  ) {
    throw new Error(
      '請輸入課堂名稱',
    )
  }

  if (
    !form.weekday
  ) {
    throw new Error(
      '請選擇星期',
    )
  }

  if (
    !form.startTime ||
    !form.endTime
  ) {
    throw new Error(
      '請設定上課時間',
    )
  }

  if (
    form.startTime >=
    form.endTime
  ) {
    throw new Error(
      '結束時間必須晚於開始時間',
    )
  }

  const sessions =
    Number(
      form.sessionsPerCycle,
    )

  if (
    !Number.isInteger(
      sessions,
    ) ||
    sessions <= 0
  ) {
    throw new Error(
      '一期堂數必須是大於 0 的整數',
    )
  }

  const price =
    Number(
      form.pricePerCycle,
    )

  if (
    !Number.isFinite(
      price,
    ) ||
    price < 0
  ) {
    throw new Error(
      '一期價格不能小於 0',
    )
  }
}

// ============================================================
// Save
// ============================================================

const saveCourse = async () => {
  if (
    saving.value
  ) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    validateForm()
  }
  catch (error) {
    errorMessage.value =
      error.message

    return
  }

  saving.value = true

  try {
    const payload = {
      name:
        form.name.trim(),

      weekday:
        Number(
          form.weekday,
        ),

      startTime:
        form.startTime,

      endTime:
        form.endTime,

      sessionsPerCycle:
        Number(
          form.sessionsPerCycle,
        ),

      pricePerCycle:
        Number(
          form.pricePerCycle,
        ),
    }

    let response

    if (
      editingCourseId.value
    ) {
      response = await $fetch(
        '/api/teacher/courses',
        {
          method: 'PATCH',

          body: {
            courseId:
              editingCourseId.value,

            ...payload,
          },
        },
      )
    }
    else {
      response = await $fetch(
        '/api/teacher/courses',
        {
          method: 'POST',
          body: payload,
        },
      )
    }

    successMessage.value =
      response.message ||
      '課堂已儲存'

    showDialog.value = false

    resetForm()

    await loadCourses()
  }
  catch (error) {
    console.error(
      '課堂儲存失敗：',
      error,
    )

    errorMessage.value =
      getErrorMessage(
        error,
        '課堂儲存失敗',
      )
  }
  finally {
    saving.value = false
  }
}

// ============================================================
// Toggle Status
// ============================================================

const toggleStatus = async (
  course,
) => {
  const nextStatus =
    course.status === 'ACTIVE'
      ? 'INACTIVE'
      : 'ACTIVE'

  const message =
    nextStatus === 'INACTIVE'
      ? `確定要停用「${course.name} ${weekdayMap[Number(course.weekday)]} ${formatTime(course.start_time)}」嗎？`
      : `確定要重新啟用這個課堂嗎？`

  if (
    !window.confirm(
      message,
    )
  ) {
    return
  }

  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await $fetch(
      '/api/teacher/courses',
      {
        method: 'PATCH',

        body: {
          courseId:
            course.id,

          status:
            nextStatus,
        },
      },
    )

    successMessage.value =
      response.message ||
      '課堂狀態已更新'

    await loadCourses()
  }
  catch (error) {
    console.error(
      '課堂狀態更新失敗：',
      error,
    )

    errorMessage.value =
      getErrorMessage(
        error,
        '課堂狀態更新失敗',
      )
  }
}

// ============================================================
// Lifecycle
// ============================================================

onMounted(
  async () => {
    await loadCourses()
  },
)
</script>

<template>
  <main class="course-page">
    <div class="container">
      <!-- ====================================================
           Header
           ==================================================== -->

      <header class="page-header">
        <div>
          <NuxtLink
            to="/teacher"
            class="back-link"
          >
            ← 學生管理
          </NuxtLink>

          <span>
            Course Management
          </span>

          <h1>
            課堂管理
          </h1>

          <p>
            每一筆就是一個實際可以上課的固定時段。
          </p>
        </div>

        <button
          type="button"
          class="create-button"
          @click="openCreate"
        >
          ＋ 新增課堂
        </button>
      </header>

      <!-- ====================================================
           Navigation
           ==================================================== -->

      <nav class="main-nav">
        <NuxtLink to="/teacher">
          學生管理
        </NuxtLink>

        <NuxtLink
          to="/teacher/courses"
          class="active"
        >
          課堂管理
        </NuxtLink>

        <NuxtLink to="/teacher/audit">
          操作紀錄
        </NuxtLink>
      </nav>

      <!-- ====================================================
           Messages
           ==================================================== -->

      <div
        v-if="errorMessage"
        class="error-message"
      >
        {{ errorMessage }}
      </div>

      <div
        v-if="successMessage"
        class="success-message"
      >
        {{ successMessage }}
      </div>

      <!-- ====================================================
           Loading
           ==================================================== -->

      <div
        v-if="loading"
        class="empty-state"
      >
        載入課堂中...
      </div>

      <template v-else>
        <!-- ==================================================
             Active Courses
             ================================================== -->

        <section class="section">
          <div class="section-header">
            <div>
              <span>
                Active Courses
              </span>

              <h2>
                目前課堂
              </h2>
            </div>

            <span>
              {{ activeCourses.length }} 個
            </span>
          </div>

          <div
            v-if="activeCourses.length"
            class="course-list"
          >
            <article
              v-for="course in activeCourses"
              :key="course.id"
              class="course-card"
            >
              <!-- ============================================
                   Main
                   ============================================ -->

              <div class="course-main">
                <div>
                  <span>
                    {{
                      weekdayMap[
                        Number(
                          course.weekday
                        )
                      ]
                    }}
                  </span>

                  <h3>
                    {{ course.name }}
                  </h3>

                  <p>
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
                  </p>
                </div>

                <span class="active-badge">
                  使用中
                </span>
              </div>

              <!-- ============================================
                   Info
                   ============================================ -->

              <div class="course-info">
                <div>
                  <span>
                    一期堂數
                  </span>

                  <strong>
                    {{
                      course.sessions_per_cycle
                    }}
                    堂
                  </strong>
                </div>

                <div>
                  <span>
                    一期價格
                  </span>

                  <strong>
                    $
                    {{
                      formatMoney(
                        course.price_per_cycle
                      )
                    }}
                  </strong>
                </div>
              </div>

              <!-- ============================================
                   Example
                   ============================================ -->

              <div class="example">
                <span>
                  學生購買時可以選
                </span>

                <div>
                  <span>
                    1 期
                    =
                    {{
                      course.sessions_per_cycle
                    }}
                    堂
                  </span>

                  <span>
                    2 期
                    =
                    {{
                      Number(
                        course.sessions_per_cycle
                      ) * 2
                    }}
                    堂
                  </span>

                  <span>
                    3 期
                    =
                    {{
                      Number(
                        course.sessions_per_cycle
                      ) * 3
                    }}
                    堂
                  </span>
                </div>
              </div>

              <!-- ============================================
                   Actions
                   ============================================ -->

              <div class="actions">
                <button
                  type="button"
                  @click="
                    openEdit(
                      course
                    )
                  "
                >
                  編輯
                </button>

                <button
                  type="button"
                  class="disable"
                  @click="
                    toggleStatus(
                      course
                    )
                  "
                >
                  停用
                </button>
              </div>
            </article>
          </div>

          <div
            v-else
            class="empty-state compact"
          >
            尚未建立課堂。
          </div>
        </section>

        <!-- ==================================================
             Inactive
             ================================================== -->

        <section
          v-if="inactiveCourses.length"
          class="section"
        >
          <div class="section-header">
            <div>
              <span>
                Inactive
              </span>

              <h2>
                已停用課堂
              </h2>
            </div>
          </div>

          <div class="inactive-list">
            <article
              v-for="course in inactiveCourses"
              :key="course.id"
            >
              <div>
                <strong>
                  {{ course.name }}
                </strong>

                <span>
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
                </span>
              </div>

              <button
                type="button"
                @click="
                  toggleStatus(
                    course
                  )
                "
              >
                重新啟用
              </button>
            </article>
          </div>
        </section>
      </template>
    </div>

    <!-- ======================================================
         Dialog
         ====================================================== -->

    <Teleport to="body">
      <div
        v-if="showDialog"
        class="dialog-mask"
        @click.self="
          !saving &&
          (
            showDialog =
              false
          )
        "
      >
        <form
          class="dialog"
          @submit.prevent="saveCourse"
        >
          <!-- ================================================
               Dialog Header
               ================================================ -->

          <header>
            <div>
              <span>
                {{
                  editingCourseId
                    ? 'Edit Course'
                    : 'New Course'
                }}
              </span>

              <h2>
                {{
                  editingCourseId
                    ? '編輯課堂'
                    : '新增課堂'
                }}
              </h2>
            </div>

            <button
              type="button"
              :disabled="saving"
              @click="
                showDialog =
                  false
              "
            >
              ×
            </button>
          </header>

          <!-- ================================================
               Name
               ================================================ -->

          <label>
            <span>
              課堂名稱
            </span>

            <input
              v-model="form.name"
              type="text"
              maxlength="100"
              placeholder="例如：踢踏舞"
              required
              :disabled="saving"
            >
          </label>

          <!-- ================================================
               Weekday
               ================================================ -->

          <label>
            <span>
              星期幾
            </span>

            <select
              v-model.number="form.weekday"
              :disabled="saving"
            >
              <option
                v-for="weekday in weekdays"
                :key="weekday.value"
                :value="weekday.value"
              >
                {{ weekday.label }}
              </option>
            </select>
          </label>

          <!-- ================================================
               Time
               ================================================ -->

          <div class="two-column">
            <label>
              <span>
                開始時間
              </span>

              <input
                v-model="form.startTime"
                type="time"
                required
                :disabled="saving"
              >
            </label>

            <label>
              <span>
                結束時間
              </span>

              <input
                v-model="form.endTime"
                type="time"
                required
                :disabled="saving"
              >
            </label>
          </div>

          <!-- ================================================
               Sessions / Price
               ================================================ -->

          <div class="two-column">
            <label>
              <span>
                一期堂數
              </span>

              <input
                v-model.number="
                  form.sessionsPerCycle
                "
                type="number"
                min="1"
                step="1"
                required
                :disabled="saving"
              >
            </label>

            <label>
              <span>
                一期價格
              </span>

              <input
                v-model.number="
                  form.pricePerCycle
                "
                type="number"
                min="0"
                step="1"
                required
                :disabled="saving"
              >
            </label>
          </div>

          <!-- ================================================
               Preview
               ================================================ -->

          <section class="preview">
            <span>
              預覽
            </span>

            <strong>
              {{
                form.name ||
                '課堂名稱'
              }}
            </strong>

            <p>
              {{
                weekdayMap[
                  Number(
                    form.weekday
                  )
                ]
              }}

              ・

              {{ form.startTime }}
              –
              {{ form.endTime }}
            </p>

            <p>
              {{
                form.sessionsPerCycle
              }}
              堂 / $
              {{
                formatMoney(
                  form.pricePerCycle
                )
              }}
            </p>
          </section>

          <!-- ================================================
               Footer
               ================================================ -->

          <footer>
            <button
              type="button"
              :disabled="saving"
              @click="
                showDialog =
                  false
              "
            >
              取消
            </button>

            <button
              type="submit"
              class="confirm"
              :disabled="saving"
            >
              {{
                saving
                  ? '儲存中...'
                  : '儲存課堂'
              }}
            </button>
          </footer>
        </form>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.course-page {
  min-height: 100vh;
  padding: 26px 18px 60px;
  background: #f6f6f6;
  color: #222222;
}

.container {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
}

/* ============================================================
   Header
   ============================================================ */

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 15px;
}

.back-link {
  display: block;
  margin-bottom: 12px;
  color: #777777;
  font-size: 10px;
  text-decoration: none;
}

.page-header > div > span {
  color: #999999;
  font-size: 8px;
  letter-spacing: 1px;
}

.page-header h1 {
  margin: 3px 0 0;
  font-size: 29px;
}

.page-header p {
  margin: 5px 0 0;
  color: #888888;
  font-size: 9px;
}

.create-button {
  min-height: 41px;
  padding: 0 14px;
  border: 0;
  background: #222222;
  border-radius: 10px;
  color: #ffffff;
  font-size: 9px;
}

/* ============================================================
   Navigation
   ============================================================ */

.main-nav {
  display: grid;
  grid-template-columns:
    repeat(
      3,
      1fr
    );
  gap: 7px;
  margin-top: 17px;
}

.main-nav a {
  padding: 10px;
  background: #ffffff;
  border-radius: 9px;
  color: #777777;
  font-size: 8px;
  text-align: center;
  text-decoration: none;
}

.main-nav a.active {
  background: #222222;
  color: #ffffff;
}

/* ============================================================
   Messages
   ============================================================ */

.error-message,
.success-message {
  margin-top: 10px;
  padding: 10px;
  border-radius: 9px;
  font-size: 9px;
}

.error-message {
  background: #fff0f0;
  color: #c94343;
}

.success-message {
  background: #eaf7ec;
  color: #418b4b;
}

/* ============================================================
   Section
   ============================================================ */

.section {
  margin-top: 19px;
}

.section-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.section-header > div > span {
  color: #999999;
  font-size: 8px;
  letter-spacing: 1px;
}

.section-header h2 {
  margin: 3px 0 9px;
  font-size: 17px;
}

.section-header > span {
  margin-bottom: 9px;
  color: #999999;
  font-size: 8px;
}

/* ============================================================
   Course Cards
   ============================================================ */

.course-list {
  display: grid;
  grid-template-columns:
    1fr
    1fr;
  gap: 8px;
}

.course-card {
  padding: 15px;
  background: #ffffff;
  border-radius: 15px;
}

.course-main {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.course-main > div > span {
  color: #999999;
  font-size: 8px;
}

.course-main h3 {
  margin: 4px 0 0;
  font-size: 16px;
}

.course-main p {
  margin: 4px 0 0;
  color: #777777;
  font-size: 9px;
}

.active-badge {
  height: fit-content;
  padding: 5px 8px;
  background: #eaf7ec;
  border-radius: 999px;
  color: #418b4b;
  font-size: 7px;
}

.course-info {
  display: grid;
  grid-template-columns:
    1fr
    1fr;
  gap: 6px;
  margin-top: 12px;
}

.course-info > div {
  padding: 10px;
  background: #f7f7f7;
  border-radius: 9px;
}

.course-info span {
  display: block;
  color: #999999;
  font-size: 7px;
}

.course-info strong {
  display: block;
  margin-top: 4px;
  font-size: 11px;
}

/* ============================================================
   Example
   ============================================================ */

.example {
  margin-top: 8px;
  padding: 9px;
  background: #fafafa;
  border-radius: 9px;
}

.example > span {
  color: #999999;
  font-size: 7px;
}

.example > div {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.example > div span {
  padding: 5px 7px;
  background: #eeeeee;
  border-radius: 7px;
  color: #666666;
  font-size: 7px;
}

/* ============================================================
   Actions
   ============================================================ */

.actions {
  display: grid;
  grid-template-columns:
    1fr
    1fr;
  gap: 6px;
  margin-top: 11px;
}

.actions button {
  min-height: 34px;
  border: 0;
  background: #eeeeee;
  border-radius: 8px;
  color: #555555;
  font-size: 8px;
}

.actions .disable {
  background: #fff0f0;
  color: #c94343;
}

/* ============================================================
   Inactive
   ============================================================ */

.inactive-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.inactive-list article {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px;
  background: #ffffff;
  border-radius: 10px;
  opacity: 0.75;
}

.inactive-list strong {
  display: block;
  font-size: 9px;
}

.inactive-list span {
  display: block;
  margin-top: 3px;
  color: #999999;
  font-size: 7px;
}

.inactive-list button {
  min-height: 31px;
  padding: 0 9px;
  border: 0;
  background: #eeeeee;
  border-radius: 7px;
  font-size: 7px;
}

/* ============================================================
   Empty
   ============================================================ */

.empty-state {
  margin-top: 12px;
  padding: 30px;
  background: #ffffff;
  border-radius: 14px;
  color: #aaaaaa;
  font-size: 9px;
  text-align: center;
}

.empty-state.compact {
  margin-top: 0;
  padding: 20px;
}

/* ============================================================
   Dialog
   ============================================================ */

.dialog-mask {
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
  max-width: 470px;
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

.dialog > label,
.two-column label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 12px;
}

.dialog label > span {
  color: #777777;
  font-size: 8px;
}

.dialog select,
.dialog input {
  width: 100%;
  min-height: 39px;
  padding: 0 9px;
  border: 1px solid #dddddd;
  background: #ffffff;
  border-radius: 9px;
}

.two-column {
  display: grid;
  grid-template-columns:
    1fr
    1fr;
  gap: 7px;
}

.preview {
  margin-top: 13px;
  padding: 12px;
  background: #222222;
  border-radius: 11px;
  color: #ffffff;
}

.preview > span {
  color: rgb(255 255 255 / 50%);
  font-size: 7px;
}

.preview strong {
  display: block;
  margin-top: 5px;
}

.preview p {
  margin: 5px 0 0;
  color: rgb(255 255 255 / 65%);
  font-size: 8px;
}

.dialog footer {
  display: grid;
  grid-template-columns:
    1fr
    2fr;
  gap: 7px;
  margin-top: 16px;
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

/* ============================================================
   RWD
   ============================================================ */

@media (
  max-width: 650px
) {
  .course-list {
    grid-template-columns:
      1fr;
  }
}

@media (
  max-width: 480px
) {
  .course-page {
    padding: 18px 12px 45px;
  }

  .page-header {
    align-items: flex-start;
  }

  .two-column {
    grid-template-columns:
      1fr;
  }
}
</style>