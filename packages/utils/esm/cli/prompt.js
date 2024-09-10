import prompts from 'prompts';
import { isNull } from "../type";

/**
 * 确认问询
 * @param message 闻讯信息
 * @param preferNo 是否默认 false
 * @param onCancel 取消回调函数
 */
export function confirm(message, preferNo, onCancel) {
  onCancel = onCancel || function () {
    return process.exit(1);
  };
  return prompts({
    type: 'confirm',
    message: message,
    name: 'confirm',
    initial: !preferNo
  }, {
    onCancel: onCancel
  }).then(function (answers) {
    return answers.confirm;
  });
}

/**
 * 选择问询
 * @param message 问询信息
 * @param choices 问询选项
 * @param initial 问询初始化数据
 */
export function select(message, choices, initial) {
  var fields = [{
    name: 'name',
    message: message,
    type: 'select',
    choices: choices,
    initial: initial
  }];
  return prompts(fields).then(function (answers) {
    return answers.name;
  });
}

/**
 * 问询
 * @param questions 问询问题列表
 * @param initials 问询初始化数据
 */
export function prompt(questions) {
  var initials = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Object.create(null);
  questions = questions.map(function (question) {
    var copied = Object.assign({}, question);
    var name = copied.name || '';
    copied.type = copied.type || isNull(copied.type) ? copied.type : 'text';
    if (initials[name]) {
      copied.initial = initials[name];
    }
    return copied;
  });
  return prompts(questions);
}

/**
 * 循环问询
 * @param questions 问询问题列表
 * @param initials 问询初始化数据
 */
export function loopPrompt(questions) {
  var initials = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : Object.create(null);
  return prompt(questions, initials).then(function (answers) {
    console.log();
    console.log('The information you entered is as follows:');
    console.log(JSON.stringify(answers, null, 2));
    console.log();
    return confirm('If the information is correct, press Y to confirm; if you need to re-enter, press N').then(function (isOK) {
      if (isOK) {
        return answers;
      } else {
        return loopPrompt(questions, answers);
      }
    });
  });
}