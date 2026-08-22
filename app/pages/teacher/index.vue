<script setup>
const {
  user,
  authenticated,
  initialized,
  loading: authLoading,
  initializeLineAuth,
} = useLineAuth()

const {
  organization,
  students,

  activeStudents,
  lineStudents,
  manualStudents,

  loading,
  submitting,
  error,

  refreshStudents,
  addStudent,
} = useTeacher()

const showStudentDialog =
  ref(false)

const message =
  ref('')

const showMessage =
  ref(false)

let toastTimer = null

const studentForm =
  reactive({
    name: '',
    phone: '',
    note: '',
  })

const resetStudentForm =
  () => {
    studentForm.name = ''
    studentForm.phone = ''
    studentForm.note = ''
  }

const showToast =
  (text) => {
    message.value =
      text

    showMessage.value =
      true

    if (toastTimer) {
      window.clearTimeout(
        toastTimer
      )
    }

    toastTimer =
      window.setTimeout(
        () => {
          showMessage.value =
            false
        },
        2500
      )
  }

const openStudentDialog =
  () => {
    resetStudentForm()

    showStudentDialog.value =
      true
  }

const closeStudentDialog =
  () => {
    if (
      submitting.value
    ) {
      return
    }

    showStudentDialog.value =
      false
  }

const handleCreateStudent =
  async () => {
    if (
      !studentForm.name.trim()
    ) {
      showToast(
        '請輸入學生姓名'
      )

      return
    }

    const result =
      await addStudent(
        studentForm
      )

    showToast(
      result.message
    )

    if (
      result.success
    ) {
      showStudentDialog.value =
        false

      resetStudentForm()
    }
  }

onMounted(
  async () => {
    const success =
      await initializeLineAuth()

    if (!success) {
      return
    }

    if (
      user.value?.role !==
      'TEACHER'
    ) {
      await navigateTo('/')

      return
    }

    await refreshStudents()

    if (error.value) {
      showToast(
        error.value
      )
    }
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
  <main class="teacher">
    <div
      v-if="
        authLoading ||
        !initialized
      "
      class="loading-page"
    >
      <div
        class="loading-spinner"
      />

      正在確認老師身分...
    </div>

    <div
      v-else-if="
        authenticated
      "
      class="teacher__container"
    >
      <!-- Header -->
      <header
        class="teacher-header"
      >
        <div>
          <span
            class="teacher-header__label"
          >
            {{
              organization?.name ||
              'TapLife Class'
            }}
          </span>

          <h1>
            老師後台
          </h1>
        </div>

        <div
          class="teacher-user"
        >
          <img
            v-if="
              user?.pictureUrl
            "
            :src="
              user.pictureUrl
            "
            :alt="
              user.displayName
            "
          >

          <div>
            <strong>
              {{
                user?.displayName ||
                '老師'
              }}
            </strong>

            <span>
              老師
            </span>
          </div>
        </div>
      </header>

      <!-- Navigation -->
      <nav
        class="teacher-nav"
      >
        <button
          type="button"
          class="
            teacher-nav__item
            teacher-nav__item--active
          "
        >
          學生
        </button>

        <button
          type="button"
          class="teacher-nav__item"
          @click="
            navigateTo(
              '/teacher/courses'
            )
          "
        >
          課程
        </button>

        <button
          type="button"
          class="teacher-nav__item"
          @click="
            navigateTo(
              '/teacher/schedule'
            )
          "
        >
          課表
        </button>

        <button
          type="button"
          class="teacher-nav__item"
          @click="
            navigateTo(
              '/teacher/settings'
            )
          "
        >
          設定
        </button>
      </nav>

      <!-- Summary -->
      <section
        class="summary-grid"
      >
        <div
          class="summary-card"
        >
          <span>
            學生總數
          </span>

          <strong>
            {{
              activeStudents.length
            }}
          </strong>
        </div>

        <div
          class="summary-card"
        >
          <span>
            LINE 學生
          </span>

          <strong>
            {{
              lineStudents.length
            }}
          </strong>
        </div>

        <div
          class="summary-card"
        >
          <span>
            手動管理
          </span>

          <strong>
            {{
              manualStudents.length
            }}
          </strong>
        </div>
      </section>

      <!-- Students -->
      <section
        class="students-card"
      >
        <div
          class="students-card__header"
        >
          <div>
            <h2>
              學生
            </h2>

            <p>
              管理學生的課程、
              堂數、請假與補課紀錄。
            </p>
          </div>

          <button
            type="button"
            class="add-button"
            @click="
              openStudentDialog
            "
          >
            ＋ 新增學生
          </button>
        </div>

        <div
          v-if="loading"
          class="students-loading"
        >
          資料載入中...
        </div>

        <div
          v-else-if="
            !students.length
          "
          class="students-empty"
        >
          <div>
            👤
          </div>

          <strong>
            還沒有學生
          </strong>

          <p>
            可以先新增不使用
            LINE 的學生，
            由老師手動管理。
          </p>

          <button
            type="button"
            @click="
              openStudentDialog
            "
          >
            新增第一位學生
          </button>
        </div>

        <div
          v-else
          class="student-list"
        >
          <button
            v-for="
              student in students
            "
            :key="
              student.id
            "
            type="button"
            class="student-item"
          >
            <div
              class="student-item__avatar"
            >
              <img
                v-if="
                  student.linePictureUrl
                "
                :src="
                  student.linePictureUrl
                "
                :alt="
                  student.name
                "
              >

              <span
                v-else
              >
                {{
                  student.name
                    .slice(0, 1)
                }}
              </span>
            </div>

            <div
              class="student-item__content"
            >
              <div
                class="student-item__name"
              >
                <strong>
                  {{
                    student.name
                  }}
                </strong>

                <span
                  v-if="
                    student.hasLine
                  "
                  class="
                    student-tag
                    student-tag--line
                  "
                >
                  LINE
                </span>

                <span
                  v-else
                  class="
                    student-tag
                  "
                >
                  手動
                </span>
              </div>

              <div
                class="student-item__meta"
              >
                <span
                  v-if="
                    student.phone
                  "
                >
                  {{
                    student.phone
                  }}
                </span>

                <span>
                  {{
                    student.courseCount
                  }}
                  門課程
                </span>
              </div>

              <p
                v-if="
                  student.note
                "
              >
                {{
                  student.note
                }}
              </p>
            </div>

            <div
              class="student-item__arrow"
            >
              ›
            </div>
          </button>
        </div>
      </section>
    </div>

    <!-- Add Student -->
    <Teleport to="body">
      <Transition
        name="dialog"
      >
        <div
          v-if="
            showStudentDialog
          "
          class="dialog-mask"
          @click.self="
            closeStudentDialog
          "
        >
          <div
            class="dialog"
          >
            <div
              class="dialog__header"
            >
              <div>
                <h2>
                  新增學生
                </h2>

                <p>
                  學生不需要
                  LINE 帳號也可以建立。
                </p>
              </div>

              <button
                type="button"
                class="close-button"
                :disabled="
                  submitting
                "
                @click="
                  closeStudentDialog
                "
              >
                ×
              </button>
            </div>

            <div
              class="form"
            >
              <label
                class="form-field"
              >
                <span>
                  學生姓名
                  <b>
                    *
                  </b>
                </span>

                <input
                  v-model="
                    studentForm.name
                  "
                  type="text"
                  maxlength="100"
                  placeholder="
                    例如：王美玲
                  "
                >
              </label>

              <label
                class="form-field"
              >
                <span>
                  聯絡電話
                </span>

                <input
                  v-model="
                    studentForm.phone
                  "
                  type="tel"
                  maxlength="50"
                  placeholder="
                    非必填
                  "
                >
              </label>

              <label
                class="form-field"
              >
                <span>
                  備註
                </span>

                <textarea
                  v-model="
                    studentForm.note
                  "
                  rows="4"
                  placeholder="
                    例如：星期六固定上課
                  "
                />
              </label>
            </div>

            <div
              class="dialog__actions"
            >
              <button
                type="button"
                class="
                  dialog-button
                  dialog-button--cancel
                "
                :disabled="
                  submitting
                "
                @click="
                  closeStudentDialog
                "
              >
                取消
              </button>

              <button
                type="button"
                class="
                  dialog-button
                  dialog-button--confirm
                "
                :disabled="
                  submitting
                "
                @click="
                  handleCreateStudent
                "
              >
                {{
                  submitting
                    ? '新增中...'
                    : '新增學生'
                }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Transition
      name="toast"
    >
      <div
        v-if="
          showMessage
        "
        class="toast"
      >
        {{ message }}
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.teacher {
  min-height: 100vh;
  padding:
    22px
    16px
    60px;
  background: #f6f6f6;
  color: #222222;
}

.teacher__container {
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
}

.teacher-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.teacher-header__label {
  color: #999999;
  font-size: 13px;
}

.teacher-header h1 {
  margin: 4px 0 0;
  font-size: 28px;
}

.teacher-user {
  display: flex;
  align-items: center;
  gap: 10px;
}

.teacher-user img {
  width: 44px;
  height: 44px;
  object-fit: cover;
  border-radius: 50%;
}

.teacher-user > div {
  display: flex;
  flex-direction: column;
}

.teacher-user strong {
  max-width: 120px;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.teacher-user span {
  color: #999999;
  font-size: 11px;
}

/* Navigation */

.teacher-nav {
  display: grid;
  grid-template-columns:
    repeat(4, 1fr);
  gap: 4px;
  margin-top: 24px;
  padding: 5px;
  background: #ebebeb;
  border-radius: 15px;
}

.teacher-nav__item {
  min-height: 40px;
  border: 0;
  background: transparent;
  border-radius: 11px;
  color: #888888;
  font-weight: 600;
  cursor: pointer;
}

.teacher-nav__item--active {
  background: #ffffff;
  color: #222222;
  box-shadow:
    0 2px 8px
    rgb(0 0 0 / 6%);
}

/* Summary */

.summary-grid {
  display: grid;
  grid-template-columns:
    repeat(3, 1fr);
  gap: 12px;
  margin-top: 18px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 18px;
  background: #ffffff;
  border-radius: 18px;
  box-shadow:
    0 6px 20px
    rgb(0 0 0 / 4%);
}

.summary-card span {
  color: #999999;
  font-size: 12px;
}

.summary-card strong {
  font-size: 25px;
}

/* Students */

.students-card {
  margin-top: 18px;
  padding: 22px;
  background: #ffffff;
  border-radius: 22px;
  box-shadow:
    0 8px 30px
    rgb(0 0 0 / 5%);
}

.students-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
}

.students-card__header h2 {
  margin: 0;
  font-size: 20px;
}

.students-card__header p {
  margin: 5px 0 0;
  color: #999999;
  font-size: 12px;
}

.add-button {
  flex-shrink: 0;
  min-height: 40px;
  padding:
    8px
    15px;
  border: 0;
  background: #222222;
  border-radius: 12px;
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
}

.students-loading {
  padding: 50px 0;
  color: #999999;
  text-align: center;
}

.students-empty {
  padding:
    45px
    20px
    25px;
  text-align: center;
}

.students-empty > div {
  font-size: 35px;
}

.students-empty strong {
  display: block;
  margin-top: 12px;
}

.students-empty p {
  margin:
    8px
    auto;
  max-width: 280px;
  color: #999999;
  font-size: 13px;
  line-height: 1.7;
}

.students-empty button {
  margin-top: 12px;
  padding:
    10px
    16px;
  border: 0;
  background: #222222;
  border-radius: 11px;
  color: #ffffff;
  cursor: pointer;
}

.student-list {
  margin-top: 16px;
}

.student-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 13px;
  padding: 15px 0;
  border: 0;
  border-bottom:
    1px solid #eeeeee;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.student-item:last-child {
  border-bottom: 0;
}

.student-item__avatar {
  display: flex;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #eeeeee;
  border-radius: 14px;
  font-weight: 700;
}

.student-item__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.student-item__content {
  min-width: 0;
  flex: 1;
}

.student-item__name {
  display: flex;
  align-items: center;
  gap: 7px;
}

.student-item__name strong {
  font-size: 14px;
}

.student-tag {
  padding:
    3px
    7px;
  background: #eeeeee;
  border-radius: 999px;
  color: #777777;
  font-size: 10px;
}

.student-tag--line {
  background: #e9f8ed;
  color: #348247;
}

.student-item__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 5px;
  color: #999999;
  font-size: 11px;
}

.student-item__content p {
  margin:
    6px
    0
    0;
  overflow: hidden;
  color: #888888;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.student-item__arrow {
  color: #bbbbbb;
  font-size: 24px;
}

/* Dialog */

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
  backdrop-filter:
    blur(3px);
}

.dialog {
  width: 100%;
  max-width: 420px;
  padding: 23px;
  background: #ffffff;
  border-radius: 22px;
  box-shadow:
    0 25px 80px
    rgb(0 0 0 / 20%);
}

.dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.dialog__header h2 {
  margin: 0;
  font-size: 21px;
}

.dialog__header p {
  margin:
    5px
    0
    0;
  color: #999999;
  font-size: 12px;
}

.close-button {
  width: 34px;
  height: 34px;
  border: 0;
  background: #f2f2f2;
  border-radius: 50%;
  color: #777777;
  font-size: 20px;
  cursor: pointer;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 22px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.form-field > span {
  color: #555555;
  font-size: 13px;
  font-weight: 600;
}

.form-field b {
  color: #d94a4a;
}

.form-field input,
.form-field textarea {
  width: 100%;
  padding:
    12px
    13px;
  border:
    1px solid #dddddd;
  outline: none;
  background: #ffffff;
  border-radius: 11px;
  font: inherit;
}

.form-field input:focus,
.form-field textarea:focus {
  border-color: #777777;
}

.dialog__actions {
  display: grid;
  grid-template-columns:
    1fr 1fr;
  gap: 10px;
  margin-top: 22px;
}

.dialog-button {
  min-height: 44px;
  border: 0;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
}

.dialog-button:disabled {
  cursor:
    not-allowed;
  opacity: 0.5;
}

.dialog-button--cancel {
  background: #eeeeee;
  color: #555555;
}

.dialog-button--confirm {
  background: #222222;
  color: #ffffff;
}

/* Common */

.loading-page {
  display: flex;
  min-height: 70vh;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #999999;
}

.loading-spinner {
  width: 25px;
  height: 25px;
  border:
    3px solid #dddddd;
  border-top-color:
    #333333;
  border-radius: 50%;
  animation:
    spin
    0.8s
    linear
    infinite;
}

@keyframes spin {
  to {
    transform:
      rotate(360deg);
  }
}

.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  z-index: 1200;
  max-width:
    calc(
      100vw - 32px
    );
  padding:
    11px
    20px;
  background:
    rgb(20 20 20 / 92%);
  border-radius: 999px;
  color: #ffffff;
  font-size: 13px;
  text-align: center;
  transform:
    translateX(-50%);
}

.dialog-enter-active,
.dialog-leave-active,
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity
    0.2s ease;
}

.dialog-enter-from,
.dialog-leave-to,
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
}

@media (
  max-width: 600px
) {
  .teacher-header {
    align-items:
      flex-start;
  }

  .teacher-user > div {
    display: none;
  }

  .teacher-nav {
    position: sticky;
    top: 8px;
    z-index: 20;
  }

  .summary-grid {
    gap: 8px;
  }

  .summary-card {
    padding:
      14px
      11px;
  }

  .summary-card strong {
    font-size: 21px;
  }

  .students-card {
    padding: 18px;
  }

  .students-card__header {
    align-items:
      flex-start;
  }

  .students-card__header p {
    display: none;
  }
}
</style>