<script setup>
definePageMeta({
  middleware: 'teacher-auth',
})

const route =
  useRoute()

const studentId =
  computed(() => {
    return String(
      route.params.id || ''
    )
  })

const loading =
  ref(true)

const saving =
  ref(false)

const enrollmentSaving =
  ref(false)

const linkCodeLoading =
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

const auditLogs =
  ref([])

const availableCourses =
  ref([])

const availableSchedules =
  ref([])

const latestLinkCode =
  ref(null)

const showEditDialog =
  ref(false)

const showEnrollmentDialog =
  ref(false)

const showLinkDialog =
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

const studentName =
  computed(() => {
    return (
      student.value?.name ||
      `學生 #${studentId.value}`
    )
  })

const isLineLinked =
  computed(() => {
    return Boolean(
      student.value?.user_id
    )
  })

const activePackages =
  computed(() => {
    return packages.value.filter(
      (item) => {
        return (
          item.status ===
          'ACTIVE'
        )
      }
    )
  })

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
        (schedule) => {
          return (
            Number(
              schedule.course_id
            ) ===
            Number(
              enrollmentForm
                .courseId
            )
          )
        }
      )
  })

const formatMoney = (
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

const formatDate = (
  value
) => {
  if (!value) {
    return '-'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value)
  }

  return new Intl
    .DateTimeFormat(
      'zh-TW',
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
    .format(date)
}

const formatDateTime = (
  value
) => {
  if (!value) {
    return '-'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value)
  }

  return new Intl
    .DateTimeFormat(
      'zh-TW',
      {
        timeZone:
          'Asia/Taipei',

        year:
          'numeric',

        month:
          '2-digit',

        day:
          '2-digit',

        hour:
          '2-digit',

        minute:
          '2-digit',

        hour12:
          false,
      }
    )
    .format(date)
}

const getWeekdayLabel = (
  weekday
) => {
  const map = {
    0: '星期日',
    1: '星期一',
    2: '星期二',
    3: '星期三',
    4: '星期四',
    5: '星期五',
    6: '星期六',
  }

  return (
    map[
      Number(weekday)
    ] ||
    String(
      weekday ?? ''
    )
  )
}

const getAttendanceLabel = (
  status
) => {
  const map = {
    ATTENDED:
      '已上課',

    LEAVE:
      '請假',

    ABSENT:
      '缺席',

    CANCELLED:
      '已取消',
  }

  return (
    map[status] ||
    status ||
    '-'
  )
}

const showToast = (
  text
) => {
  successMessage.value =
    text

  if (toastTimer) {
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
      2200
    )
}

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
        response?.student ||
        null

      enrollments.value =
        response?.enrollments ||
        []

      packages.value =
        response?.packages ||
        []

      attendanceRecords.value =
        response
          ?.attendanceRecords ||
        []

      auditLogs.value =
        response?.auditLogs ||
        []

      availableCourses.value =
        response
          ?.availableCourses ||
        []

      availableSchedules.value =
        response
          ?.availableSchedules ||
        []

      latestLinkCode.value =
        response
          ?.latestLinkCode ||
        null
    } catch (error) {
      console.error(
        '取得學生詳情失敗：',
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

const openEditDialog =
  () => {
    editForm.name =
      student.value?.name ||
      ''

    showEditDialog.value =
      true
  }

const closeEditDialog =
  () => {
    if (saving.value) {
      return
    }

    showEditDialog.value =
      false
  }

const saveStudent =
  async () => {
    if (saving.value) {
      return
    }

    const name =
      editForm.name.trim()

    if (!name) {
      errorMessage.value =
        '請輸入學生姓名'

      return
    }

    saving.value =
      true

    errorMessage.value =
      ''

    try {
      const response =
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

      student.value =
        response.student

      showEditDialog.value =
        false

      showToast(
        response.message ||
        '學生資料更新成功'
      )
    } catch (error) {
      console.error(
        '更新學生失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        '學生資料更新失敗'
    } finally {
      saving.value =
        false
    }
  }

const openEnrollmentDialog =
  () => {
    enrollmentForm.courseId =
      ''

    enrollmentForm.scheduleId =
      ''

    showEnrollmentDialog.value =
      true
  }

const closeEnrollmentDialog =
  () => {
    if (
      enrollmentSaving.value
    ) {
      return
    }

    showEnrollmentDialog.value =
      false
  }

const handleCourseChange =
  () => {
    enrollmentForm.scheduleId =
      ''
  }

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
      errorMessage.value =
        '請選擇課程'

      return
    }

    enrollmentSaving.value =
      true

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          `/api/teacher/students/${studentId.value}/enrollments`,
          {
            method:
              'POST',

            body: {
              courseId:
                Number(
                  enrollmentForm
                    .courseId
                ),

              scheduleId:
                enrollmentForm
                  .scheduleId
                  ? Number(
                      enrollmentForm
                        .scheduleId
                    )
                  : null,
            },
          }
        )

      showEnrollmentDialog.value =
        false

      showToast(
        response.message ||
        '學生已加入課程'
      )

      await fetchStudent()
    } catch (error) {
      console.error(
        '建立 Enrollment 失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        '加入課程失敗'
    } finally {
      enrollmentSaving.value =
        false
    }
  }

const generateLinkCode =
  async () => {
    if (
      linkCodeLoading.value ||
      isLineLinked.value
    ) {
      return
    }

    linkCodeLoading.value =
      true

    errorMessage.value =
      ''

    try {
      const response =
        await $fetch(
          `/api/teacher/students/${studentId.value}/link-code`,
          {
            method:
              'POST',
          }
        )

      latestLinkCode.value =
        response.linkCode

      showLinkDialog.value =
        true
    } catch (error) {
      console.error(
        '產生綁定碼失敗：',
        error
      )

      errorMessage.value =
        error?.data
          ?.statusMessage ||
        error?.statusMessage ||
        error?.message ||
        '產生綁定碼失敗'
    } finally {
      linkCodeLoading.value =
        false
    }
  }

const copyLinkCode =
  async () => {
    const code =
      latestLinkCode.value
        ?.code

    if (!code) {
      return
    }

    await navigator
      .clipboard
      .writeText(
        code
      )

    showToast(
      '綁定碼已複製'
    )
  }

onMounted(
  async () => {
    await fetchStudent()
  }
)

onBeforeUnmount(
  () => {
    if (toastTimer) {
      window.clearTimeout(
        toastTimer
      )
    }
  }
)
</script>

<template>
  <main class="student-detail-page">
    <div class="detail-container">
      <div
        v-if="loading"
        class="loading-state"
      >
        <div class="loader" />

        <span>
          正在載入學生資料
        </span>
      </div>

      <template
        v-else-if="student"
      >
        <header class="page-header">
          <div>
            <NuxtLink
              to="/teacher/students"
              class="back-link"
            >
              ← 學生列表
            </NuxtLink>

            <span class="eyebrow">
              Student Detail
            </span>

            <h1>
              {{ studentName }}
            </h1>

            <p>
              學生課程、方案與歷史紀錄
            </p>
          </div>

          <button
            type="button"
            class="
              primary-button
              header-button
            "
            @click="
              openEditDialog
            "
          >
            編輯資料
          </button>
        </header>

        <section class="summary-grid">
          <article class="summary-card">
            <span>
              目前課程
            </span>

            <strong>
              {{ enrollments.length }}
            </strong>

            <small>
              Enrollment
            </small>
          </article>

          <article class="summary-card">
            <span>
              Active Package
            </span>

            <strong>
              {{ activePackages.length }}
            </strong>

            <small>
              目前進行中
            </small>
          </article>

          <article class="summary-card">
            <span>
              上課紀錄
            </span>

            <strong>
              {{ attendanceRecords.length }}
            </strong>

            <small>
              最近資料
            </small>
          </article>

          <article class="summary-card">
            <span>
              LINE
            </span>

            <strong
              class="status-text"
              :class="{
                'status-text--linked':
                  isLineLinked,
              }"
            >
              {{
                isLineLinked
                  ? '已綁定'
                  : '未綁定'
              }}
            </strong>

            <small>
              學生端帳號
            </small>
          </article>
        </section>

        <section class="content-grid">
          <article class="panel">
            <div class="panel__header">
              <div>
                <span>
                  Profile
                </span>

                <h2>
                  基本資料
                </h2>
              </div>

              <button
                type="button"
                class="text-button"
                @click="
                  openEditDialog
                "
              >
                修改
              </button>
            </div>

            <div class="info-list">
              <div class="info-row">
                <span>
                  姓名
                </span>

                <strong>
                  {{
                    student.name ||
                    '-'
                  }}
                </strong>
              </div>

              <div class="info-row">
                <span>
                  Student ID
                </span>

                <strong>
                  {{ student.id }}
                </strong>
              </div>
            </div>
          </article>

          <article class="panel">
            <div class="panel__header">
              <div>
                <span>
                  LINE
                </span>

                <h2>
                  LINE 綁定
                </h2>
              </div>
            </div>

            <div
              v-if="isLineLinked"
              class="
                line-status
                line-status--linked
              "
            >
              <div class="line-status__icon">
                ✓
              </div>

              <div>
                <strong>
                  已完成 LINE 綁定
                </strong>

                <span>
                  學生可以從學生 LIFF 查看自己的資料。
                </span>
              </div>
            </div>

            <div
              v-else
              class="line-status"
            >
              <div class="line-status__icon">
                !
              </div>

              <div>
                <strong>
                  尚未綁定 LINE
                </strong>

                <span>
                  可以產生一次性綁定碼交給學生。
                </span>
              </div>

              <button
                type="button"
                class="
                  primary-button
                  link-code-button
                "
                :disabled="
                  linkCodeLoading
                "
                @click="
                  generateLinkCode
                "
              >
                {{
                  linkCodeLoading
                    ? '產生中...'
                    : '產生綁定碼'
                }}
              </button>
            </div>
          </article>
        </section>

        <section
          class="
            panel
            section-panel
          "
        >
          <div class="panel__header">
            <div>
              <span>
                Enrollment
              </span>

              <h2>
                學生課程
              </h2>
            </div>

            <button
              type="button"
              class="
                primary-button
                small-button
              "
              @click="
                openEnrollmentDialog
              "
            >
              ＋ 加入課程
            </button>
          </div>

          <div
            v-if="
              enrollments.length
            "
            class="enrollment-list"
          >
            <div
              v-for="
                enrollment in
                  enrollments
              "
              :key="
                enrollment.id
              "
              class="enrollment-row"
            >
              <div class="enrollment-icon">
                ♪
              </div>

              <div class="enrollment-main">
                <strong>
                  {{
                    enrollment.course_name ||
                    `課程 #${enrollment.course_id}`
                  }}
                </strong>

                <span
                  v-if="
                    enrollment.schedule_weekday !==
                    null &&
                    enrollment.schedule_weekday !==
                    undefined
                  "
                >
                  {{
                    getWeekdayLabel(
                      enrollment.schedule_weekday
                    )
                  }}

                  {{
                    String(
                      enrollment.schedule_start_time ||
                      ''
                    ).slice(
                      0,
                      5
                    )
                  }}
                </span>

                <span v-else>
                  未設定預設班別
                </span>
              </div>
            </div>
          </div>

          <div
            v-else
            class="empty-state"
          >
            尚未加入任何課程
          </div>
        </section>

        <section
          class="
            panel
            section-panel
          "
        >
          <div class="panel__header">
            <div>
              <span>
                Package
              </span>

              <h2>
                堂數方案
              </h2>
            </div>
          </div>

          <div
            v-if="
              packages.length
            "
            class="package-list"
          >
            <div
              v-for="
                item in packages
              "
              :key="item.id"
              class="package-card"
            >
              <div>
                <span>
                  第
                  {{
                    item.cycle_no ||
                    1
                  }}
                  期
                </span>

                <strong>
                  {{
                    item.total_sessions
                  }}
                  堂
                </strong>
              </div>

              <div class="package-card__right">
                <span>
                  NT$
                  {{
                    formatMoney(
                      item.price
                    )
                  }}
                </span>

                <strong>
                  {{ item.status }}
                </strong>
              </div>
            </div>
          </div>

          <div
            v-else
            class="empty-state"
          >
            尚未建立堂數方案
          </div>
        </section>
      </template>
    </div>

    <Teleport to="body">
      <Transition name="dialog">
        <div
          v-if="showEditDialog"
          class="dialog-mask"
          @click.self="
            closeEditDialog
          "
        >
          <form
            class="dialog"
            @submit.prevent="
              saveStudent
            "
          >
            <div class="dialog__header">
              <div>
                <span>
                  Edit Student
                </span>

                <h2>
                  修改學生資料
                </h2>
              </div>

              <button
                type="button"
                class="close-button"
                @click="
                  closeEditDialog
                "
              >
                ×
              </button>
            </div>

            <div class="form-group">
              <label>
                學生姓名
              </label>

              <input
                v-model="
                  editForm.name
                "
                type="text"
                maxlength="100"
              >
            </div>

            <div class="dialog__actions">
              <button
                type="button"
                class="secondary-button"
                @click="
                  closeEditDialog
                "
              >
                取消
              </button>

              <button
                type="submit"
                class="primary-button"
                :disabled="saving"
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
      </Transition>

      <Transition name="dialog">
        <div
          v-if="
            showEnrollmentDialog
          "
          class="dialog-mask"
          @click.self="
            closeEnrollmentDialog
          "
        >
          <form
            class="dialog"
            @submit.prevent="
              createEnrollment
            "
          >
            <div class="dialog__header">
              <div>
                <span>
                  Enrollment
                </span>

                <h2>
                  加入課程
                </h2>
              </div>

              <button
                type="button"
                class="close-button"
                @click="
                  closeEnrollmentDialog
                "
              >
                ×
              </button>
            </div>

            <div class="form-group">
              <label>
                課程
              </label>

              <select
                v-model="
                  enrollmentForm.courseId
                "
                @change="
                  handleCourseChange
                "
              >
                <option value="">
                  請選擇課程
                </option>

                <option
                  v-for="
                    course in
                      availableCourses
                  "
                  :key="course.id"
                  :value="course.id"
                >
                  {{ course.name }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label>
                預設上課時段
              </label>

              <select
                v-model="
                  enrollmentForm.scheduleId
                "
                :disabled="
                  !enrollmentForm.courseId
                "
              >
                <option value="">
                  不指定
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
                    ).slice(
                      0,
                      5
                    )
                  }}
                </option>
              </select>
            </div>

            <div class="dialog__actions">
              <button
                type="button"
                class="secondary-button"
                @click="
                  closeEnrollmentDialog
                "
              >
                取消
              </button>

              <button
                type="submit"
                class="primary-button"
                :disabled="
                  enrollmentSaving ||
                  !enrollmentForm.courseId
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
      </Transition>

      <Transition name="dialog">
        <div
          v-if="showLinkDialog"
          class="dialog-mask"
          @click.self="
            showLinkDialog = false
          "
        >
          <div class="dialog">
            <div class="dialog__header">
              <div>
                <span>
                  LINE Binding
                </span>

                <h2>
                  學生綁定碼
                </h2>
              </div>

              <button
                type="button"
                class="close-button"
                @click="
                  showLinkDialog = false
                "
              >
                ×
              </button>
            </div>

            <p class="link-description">
              請將下方綁定碼交給
              {{ studentName }}。
            </p>

            <div class="link-code">
              {{
                latestLinkCode?.code
              }}
            </div>

            <p class="link-expire">
              有效期限：
              {{
                formatDateTime(
                  latestLinkCode?.expires_at
                )
              }}
            </p>

            <button
              type="button"
              class="
                primary-button
                copy-button
              "
              @click="
                copyLinkCode
              "
            >
              複製綁定碼
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Transition name="toast">
      <div
        v-if="
          successMessage
        "
        class="toast"
      >
        {{ successMessage }}
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.student-detail-page {
  min-height: 100vh;
  padding: 28px 20px 60px;
  background: #f6f6f6;
  color: #222222;
}

.detail-container {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.back-link {
  display: block;
  margin-bottom: 16px;
  color: #777777;
  font-size: 12px;
  text-decoration: none;
}

.eyebrow,
.panel__header span {
  color: #999999;
  font-size: 11px;
  letter-spacing: 1px;
}

.page-header h1 {
  margin: 4px 0 0;
  font-size: 28px;
}

.page-header p {
  color: #888888;
  font-size: 13px;
}

.summary-grid {
  display: grid;
  grid-template-columns:
    repeat(
      4,
      minmax(0, 1fr)
    );
  gap: 14px;
  margin-top: 24px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  min-height: 120px;
  padding: 18px;
  background: #ffffff;
  border-radius: 20px;
}

.summary-card span {
  color: #888888;
  font-size: 11px;
}

.summary-card strong {
  margin-top: 12px;
  font-size: 27px;
}

.summary-card small {
  margin-top: auto;
  color: #aaaaaa;
}

.status-text {
  font-size: 18px !important;
}

.status-text--linked {
  color: #4b9450;
}

.content-grid {
  display: grid;
  grid-template-columns:
    repeat(
      2,
      1fr
    );
  gap: 18px;
  margin-top: 18px;
}

.panel {
  padding: 22px;
  background: #ffffff;
  border-radius: 24px;
}

.section-panel {
  margin-top: 18px;
}

.panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel__header h2 {
  margin: 4px 0 0;
}

.info-row {
  display: flex;
  justify-content: space-between;
  min-height: 52px;
  align-items: center;
  border-bottom: 1px solid #eeeeee;
}

.info-row span {
  color: #888888;
  font-size: 12px;
}

.line-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #f7f7f7;
  border-radius: 17px;
}

.line-status__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  background: #eeeeee;
  border-radius: 12px;
}

.line-status > div:nth-child(2) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.line-status span {
  margin-top: 4px;
  color: #888888;
  font-size: 11px;
}

.enrollment-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 68px;
  border-bottom: 1px solid #eeeeee;
}

.enrollment-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: #f1f1f1;
  border-radius: 13px;
}

.enrollment-main {
  display: flex;
  flex-direction: column;
}

.enrollment-main span {
  margin-top: 4px;
  color: #999999;
  font-size: 11px;
}

.package-list {
  display: grid;
  grid-template-columns:
    repeat(
      3,
      1fr
    );
  gap: 12px;
}

.package-card {
  display: flex;
  justify-content: space-between;
  padding: 16px;
  background: #f7f7f7;
  border-radius: 17px;
}

.package-card > div {
  display: flex;
  flex-direction: column;
}

.package-card__right {
  align-items: flex-end;
}

.empty-state {
  padding: 28px;
  color: #aaaaaa;
  text-align: center;
}

.primary-button,
.secondary-button {
  min-height: 44px;
  border: 0;
  border-radius: 13px;
  cursor: pointer;
}

.primary-button {
  width: 100%;
  margin-top: 18px;
  background: #222222;
  color: #ffffff;
}

.header-button,
.small-button,
.link-code-button {
  width: auto;
  padding:
    0
    15px;
  margin: 0;
}

.secondary-button {
  background: #eeeeee;
}

.text-button {
  border: 0;
  background: none;
}

.dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    rgb(0 0 0 / 45%);
}

.dialog {
  width: calc(
    100% - 40px
  );
  max-width: 430px;
  padding: 24px;
  background: #ffffff;
  border-radius: 24px;
}

.dialog__header {
  display: flex;
  justify-content: space-between;
}

.close-button {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 50%;
}

.form-group {
  display: flex;
  flex-direction: column;
  margin-top: 20px;
}

.form-group input,
.form-group select {
  height: 46px;
  margin-top: 7px;
  padding:
    0
    12px;
}

.dialog__actions {
  display: grid;
  grid-template-columns:
    1fr 1fr;
  gap: 10px;
  margin-top: 24px;
}

.dialog__actions
.primary-button {
  margin: 0;
}

.link-description {
  color: #777777;
  line-height: 1.7;
}

.link-code {
  padding: 20px;
  background: #f3f3f3;
  border-radius: 17px;
  font-size: 27px;
  font-weight: 700;
  letter-spacing: 5px;
  text-align: center;
}

.link-expire {
  color: #999999;
  font-size: 11px;
  text-align: center;
}

.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  padding:
    11px
    20px;
  background: #222222;
  border-radius: 999px;
  color: white;
  transform:
    translateX(-50%);
}

.loader {
  width: 40px;
  height: 40px;
  border: 4px solid #eeeeee;
  border-top-color: #222222;
  border-radius: 50%;
  animation:
    loading
    0.75s
    linear infinite;
}

.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 50vh;
}

@keyframes loading {
  to {
    transform:
      rotate(360deg);
  }
}

@media (
  max-width: 800px
) {
  .summary-grid {
    grid-template-columns:
      repeat(
        2,
        1fr
      );
  }

  .content-grid {
    grid-template-columns:
      1fr;
  }

  .package-list {
    grid-template-columns:
      1fr;
  }
}
</style>