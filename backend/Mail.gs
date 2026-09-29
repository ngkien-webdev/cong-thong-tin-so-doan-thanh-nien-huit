function mailEnabled_(){return PropertiesService.getScriptProperties().getProperty('MAIL_ENABLED')==='true';}

// Vietnam uses UTC+7 year-round. Next calendar day, including weekends.
function nextMorning_(submittedAt) {
  const instant=new Date(submittedAt);
  if(!Number.isFinite(instant.getTime()))fail_('INVALID_INPUT','Thời gian nộp hồ sơ không hợp lệ.');
  const vn=new Date(instant.getTime()+7*3600000);
  return new Date(Date.UTC(vn.getUTCFullYear(),vn.getUTCMonth(),vn.getUTCDate()+1,1,0,0)).toISOString();
}
function makeReminder_(application) {
  return {id:'hardcopy-'+application.id,applicationId:application.id,recipient:application.email,studentName:application.studentName,dueAt:nextMorning_(application.submittedAt),state:'pending',attempts:0,updatedAt:application.submittedAt,sentAt:'',error:''};
}
function reminderMessage_(job) {
  return {to:job.recipient,subject:'[Đoàn - Hội HUIT] Nhắc nộp bản cứng hồ sơ kế hoạch '+job.applicationId,
    name:'Đoàn - Hội HUIT',body:[
      'Chào '+job.studentName+',','',
      'Hệ thống đã tiếp nhận hồ sơ kế hoạch của bạn với mã '+job.applicationId+'.',
      'Vui lòng nộp bản cứng hồ sơ kế hoạch tại Văn phòng Đoàn trường để hoàn tất việc tiếp nhận.',
      'Khi đến nộp, vui lòng cung cấp mã hồ sơ để cán bộ đối chiếu.',
      '', 'Nếu bạn đã nộp bản cứng, vui lòng bỏ qua email này và liên hệ Văn phòng Đoàn để xác nhận.',
      '', 'Đoàn Thanh niên - Hội Sinh viên HUIT'
    ].join('\n')};
}
function saveMailJob_(index,job){Sheets.Spreadsheets.batchUpdate({requests:[updateRequest_('MailQueue',index,job)]},prop_('SPREADSHEET_ID'));}

/** Time trigger only. Never exposed as a public API action. */
function processReminderQueue() {
  if(!mailEnabled_())return;
  const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
  try {
    const now=new Date(),jobs=records_('MailQueue');
    const apps=new Map(records_('Applications').map(a=>[a.id,a]));
    const received=new Set(records_('Hardcopies').map(r=>r.applicationId));
    let remaining=MailApp.getRemainingDailyQuota(),handled=0;
    for(let i=0;i<jobs.length;i++) {
      const job=jobs[i];
      if(job.state==='sending'&&now-new Date(job.updatedAt)>10*60000){saveMailJob_(i,Object.assign({},job,{state:'uncertain',updatedAt:now.toISOString(),error:'Lần gửi trước bị gián đoạn; cần kiểm tra trước khi gửi lại.'}));continue;}
      if(job.state!=='pending')continue;
      const due=new Date(job.dueAt);
      if(!Number.isFinite(due.getTime())){saveMailJob_(i,Object.assign({},job,{state:'uncertain',updatedAt:now.toISOString(),error:'Lịch gửi không hợp lệ. Cần kiểm tra dữ liệu.'}));continue;}
      if(due>now)continue;
      const application=apps.get(job.applicationId);
      if(!application||!isPlan_(application.docType)||application.status==='Từ chối'||received.has(job.applicationId)){saveMailJob_(i,Object.assign({},job,{state:'cancelled',updatedAt:now.toISOString(),error:'Không còn cần nhắc nộp bản cứng.'}));continue;}
      if(job.recipient!==application.email){saveMailJob_(i,Object.assign({},job,{state:'uncertain',updatedAt:now.toISOString(),error:'Người nhận không khớp email trong hồ sơ. Cần kiểm tra dữ liệu.'}));continue;}
      if(remaining<1||handled>=20||Date.now()-now.getTime()>45000)break;
      // Persist intent BEFORE sending. Never retry an ambiguous send automatically.
      const sending=Object.assign({},job,{state:'sending',attempts:Number(job.attempts||0)+1,updatedAt:now.toISOString(),error:''});
      saveMailJob_(i,sending);
      try {
        MailApp.sendEmail(reminderMessage_(job));
        remaining--;handled++;
        saveMailJob_(i,Object.assign({},sending,{state:'sent',sentAt:new Date().toISOString(),updatedAt:new Date().toISOString()}));
      } catch(error) {
        saveMailJob_(i,Object.assign({},sending,{state:'uncertain',updatedAt:new Date().toISOString(),error:'Không xác nhận được kết quả gửi. Kiểm tra hộp thư đã gửi hoặc nhật ký trước khi thử lại.'}));
        handled++;
      }
    }
  } finally {lock.releaseLock();}
}

/** Run once as the account authorized to send reminders, after schema setup.
 * One minute polling avoids the ±15 minute jitter of nearMinute(0).
 * Actual delivery is still subject to Google's trigger scheduling and quota.
 */
function installReminderTrigger() {
  sheet_('Applications');sheet_('MailQueue');sheet_('Hardcopies');
  MailApp.getRemainingDailyQuota();
  const existing=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='processReminderQueue');
  if(!existing.length)ScriptApp.newTrigger('processReminderQueue').timeBased().everyMinutes(1).create();
  PropertiesService.getScriptProperties().setProperty('MAIL_ENABLED','true');
}
function pauseReminderEmails(){PropertiesService.getScriptProperties().setProperty('MAIL_ENABLED','false');}
