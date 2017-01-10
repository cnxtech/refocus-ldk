'use strict';
require('./lens.css');

// Put any external libraries in the lib directory and require them here
// require('./lib/example.js');

const handlebars = require('handlebars-template-loader/runtime');
const loadingTemplate = require('./template/loading.handlebars');
const mainTemplate = require('./template/main.handlebars');
handlebars.registerPartial('subject', require('./template/subject.handlebars'));
handlebars.registerPartial('aspect', require('./template/aspect.handlebars'));
handlebars.registerPartial('sample', require('./template/sample.handlebars'));

handlebars.registerHelper('listClass', (array) => {
  if (array == null) return '';
  if (array.length <= 3) return 'inline';
  else return 'multiline';
});

let subjects = new Map();
let aspects = new Map();
let samples = new Map();

const LENS = document.getElementById('lens');

LENS.addEventListener('refocus.lens.load', () => {
  LENS.addEventListener('refocus.lens.hierarchyLoad', onHierarchyLoad);
  LENS.addEventListener('refocus.lens.realtime.change', onRealtimeChange);
  LENS.innerHTML = loadingTemplate();
});

/**
 * Handle the refocus.lens.hierarchyLoad event. The hierarchy JSON is stored
 * in evt.detail. Preprocess the hierarchy, hide the loading indicator, then call draw.
 */
function onHierarchyLoad(evt) {
  console.log(new Date(), '#lens => refocus.lens.hierarchyLoad');
  preprocess(evt.detail);
  document.getElementById('loading').setAttribute('hidden', 'true');
  draw();
} // onHierarchyLoad

/**
 * Process the hierarchy data into a data structure optimized for this lens.
 */
function preprocess(node) {
  formatDateFields(node);
  subjects.set(node.absolutePath, node);
  if (node.samples) {
    node.samples.forEach((sample) => {
      sample.subjectId = node.id;
      sample.subjectAbsolutePath = node.absolutePath;
      formatDateFields(sample);
      formatDateFields(sample.aspect);
      samples.set(sample.name, sample);
      aspects.set(sample.aspect.name, sample.aspect);
    })
  }
  if (node.children) {
    node.children.forEach((child) => {
      preprocess(child);
    })
  }
} // preprocess

function formatDateFields(object) {
  let fields = ['createdAt', 'updatedAt', 'statusChangedAt'];
  fields.forEach((field) => {
    let currentValue = object[field];
    if (currentValue)
      object[field] = new Date(currentValue).toLocaleString();
  });
} // formatDateFields


/**
 * This function modifies the DOM.
 */
function draw() {
  let context = {
    "subjects": Array.from(subjects.values()),
    "aspects": Array.from(aspects.values()),
    "samples": Array.from(samples.values())
  };
  LENS.innerHTML = mainTemplate(context);
} // draw

/**
 * Handle the refocus.lens.realtime.change event. The array of changes is
 * stored in evt.detail. Iterate over the array to perform any preprocessing
 * if needed, then call draw only once after all the data manipulation is
 * done.
 */
function onRealtimeChange(evt) {
  console.log(new Date(), 'refocus.lens.realtime.change',
    'contains ' + evt.detail.length + ' changes');
  if (!Array.isArray(evt.detail) || evt.detail.length == 0) {
    return;
  }

  evt.detail.forEach((chg) => {
    if (chg['sample.add']) {
      realtimeChangeHandler.onSampleAdd(chg['sample.add'])
    } else if (chg['sample.remove']) {
      realtimeChangeHandler.onSampleRemove(chg['sample.remove'])
    } else if (chg['sample.update']) {
      realtimeChangeHandler.onSampleUpdate(chg['sample.update']);
    } else if (chg['subject.add']) {
      realtimeChangeHandler.onSubjectAdd(chg['subject.add'])
    } else if (chg['subject.remove']) {
      realtimeChangeHandler.onSubjectRemove(chg['subject.remove'])
    } else if (chg['subject.update']) {
      realtimeChangeHandler.onSubjectUpdate(chg['subject.update'])
    }
  }); // evt.detail.forEach

  // Now that we've processed all these changes, draw!
  draw();
} // onRealtimeChange

const realtimeChangeHandler = {
  onSampleAdd(sample) {
    samples.set(sample.name, sample);
    let [subject] = getSubjectAndIndex(sample);
    subject.samples.push(sample);
  },
  onSampleRemove(sample) {
    samples.delete(sample.name);
    let [subject, index] = getSubjectAndIndex(sample);
    subject.samples.splice(index, 1);
  },
  onSampleUpdate(change) {
    let sample = change.new;
    samples.set(sample.name, sample);
    let [subject, index] = getSubjectAndIndex(sample);
    subject.samples[index] = sample;
  },
  onSubjectAdd(subject) {
    subjects.set(subject.absolutePath, subject);
  },
  onSubjectRemove(subject) {
    subjects.delete(subject.absolutePath);
  },
  onSubjectUpdate(change) {
    let subject = change.new;
    subjects.set(subject.absolutePath, subject);
  }
}; // realtimeChangeHandler

function getSubjectAndIndex(sample) {
  let subjectPath = sample.name.split('|')[0];
  let subject = subjects.get(subjectPath);
  let index = subject.samples.findIndex( (s) => s.name === sample.name );
  return [subject, index];
} // getSubjectAndIndex
