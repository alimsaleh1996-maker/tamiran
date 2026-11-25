"""Race the same part issue from two independently authenticated sessions."""
import concurrent.futures
import threading


def issue_once_concurrently(clients, payload):
    gate = threading.Barrier(len(clients))
    def submit(client):
        gate.wait(timeout=10)
        return client.api('inventory-v2.php', 'POST', payload)
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(clients)) as pool:
        results = list(pool.map(submit, clients))
    assert len({result['issuePublicId'] for result in results}) == 1, 'duplicate part issues'
    return results[0]
