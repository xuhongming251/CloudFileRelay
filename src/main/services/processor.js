const axios = require('axios');
const AdmZip = require('adm-zip');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

class GitHubProcessor {
    constructor(token, repoUrl) {
        this.token = token;
        this.baseUrl = repoUrl.replace('https://github.com/', 'https://api.github.com/repos/');
        this.headers = {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        };
    }

    generateTaskId(channel = 'task') {
        const dateStr = dayjs().format('MMDD_HHmmss');
        // 将通道名转换为英文小写，并只保留英文字母
        const channelTag = channel.toLowerCase().replace(/[^a-z]/g, '') || 'task';
        return `task_${dateStr}_${channelTag}`;
    }

    async execTask(workflowFile, inputs, traceId) {
        const url = `${this.baseUrl}/actions/workflows/${workflowFile}/dispatches`;
        const data = {
            ref: 'main',
            inputs: { trace_id: traceId, ...inputs }
        };
        try {
            const resp = await axios.post(url, data, { headers: this.headers });
            return { success: resp.status === 204, status: resp.status };
        } catch (err) {
            return { success: false, error: err.response?.data || err.message };
        }
    }

    async findTaskByTaskId(workflowFile, traceId) {
        const url = `${this.baseUrl}/actions/workflows/${workflowFile}/runs`;
        const resp = await axios.get(url, { 
            headers: this.headers,
            params: { event: 'workflow_dispatch', branch: 'main', per_page: 20 }
        });
        const runs = resp.data.workflow_runs || [];
        return runs.find(run => (run.name || '').includes(traceId) || (run.display_title || '').includes(traceId));
    }

    async getTaskStatus(runId) {
        const url = `${this.baseUrl}/actions/runs/${runId}`;
        const resp = await axios.get(url, { headers: this.headers });
        return resp.data;
    }

    async getTaskJobs(runId) {
        const url = `${this.baseUrl}/actions/runs/${runId}/jobs`;
        const resp = await axios.get(url, { headers: this.headers });
        return resp.data;
    }

    async getResult(runId, artifactName = 'result') {
        const url = `${this.baseUrl}/actions/runs/${runId}/artifacts`;
        const resp = await axios.get(url, { headers: this.headers });
        const artifacts = resp.data.artifacts || [];
        const target = artifacts.find(a => a.name === artifactName);
        if (!target) return null;

        const downloadUrl = `${this.baseUrl}/actions/artifacts/${target.id}/zip`;
        const zipResp = await axios.get(downloadUrl, { 
            headers: this.headers, 
            responseType: 'arraybuffer' 
        });

        try {
            const zip = new AdmZip(Buffer.from(zipResp.data));
            const entry = zip.getEntry('result.json');
            if (entry) {
                return JSON.parse(entry.getData().toString('utf8'));
            }
        } catch (e) {
            console.error('解析结果失败:', e);
        }
        return null;
    }
}

module.exports = GitHubProcessor;
