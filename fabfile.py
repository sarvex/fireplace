import os

import fabdeploytools.envs
from fabric.api import env, lcd, local, task
from fabdeploytools import helpers

import deploysettings as settings

env.key_filename = settings.SSH_KEY
fabdeploytools.envs.loadenv(settings.CLUSTER)

ROOT, FIREPLACE = helpers.get_app_dirs(__file__)
COMMONPLACE = f'{FIREPLACE}/node_modules/.bin/commonplace'

if settings.ZAMBONI_DIR:
    helpers.scl_enable('python27')
    ZAMBONI = f'{settings.ZAMBONI_DIR}/zamboni'
    ZAMBONI_PYTHON = f'{settings.ZAMBONI_DIR}/venv/bin/python'

os.environ['DJANGO_SETTINGS_MODULE'] = 'settings_local_mkt'
os.environ["PATH"] += os.pathsep + os.pathsep.join([COMMONPLACE])

PACKAGE_NAME = getattr(settings, 'PACKAGE_NAME', 'marketplace')


@task
def pre_update(ref):
    with lcd(FIREPLACE):
        local('git fetch')
        local('git fetch -t')
        local(f'git reset --hard {ref}')


@task
def build():
    with lcd(FIREPLACE):
        local('npm install')
        local('make install')
        local('cp src/media/js/settings_local_hosted.js '
              'src/media/js/settings_local.js')

        local('make build')
        local('node_modules/.bin/commonplace langpacks')


@task
def deploy_jenkins():
    rpm = helpers.build_rpm(name=settings.PROJECT_NAME,
                            env=settings.ENV,
                            cluster=settings.CLUSTER,
                            domain=settings.DOMAIN,
                            root=ROOT,
                            app_dir='fireplace')

    rpm.local_install()

    # do not perform a package update in prod
    if settings.ZAMBONI_DIR and settings.ENV != 'prod':
        package_update(os.path.join(rpm.install_to, 'fireplace'))

    rpm.remote_install(['web'])

    deploy_build_id('fireplace')


@task
def update():
    with lcd(FIREPLACE):
        local('npm install')
        local('make install')
        local('cp src/media/js/settings_local_hosted.js '
              'src/media/js/settings_local.js')

        # do not perform a package update in prod
        if settings.ZAMBONI_DIR and settings.ENV != 'prod':
            package_update()

        local('make build')

        local('node_modules/.bin/commonplace langpacks')


@task
def package_update(build_dir=FIREPLACE):
    if PACKAGE_NAME != 'dev-feed':
        build_package(settings.ENV, build_dir)
        upload_package(fireplace_package(settings.ENV, build_dir),
                       PACKAGE_NAME)


@task
def deploy():
    helpers.deploy(name=settings.PROJECT_NAME,
                   app_dir='fireplace',
                   env=settings.ENV,
                   cluster=settings.CLUSTER,
                   domain=settings.DOMAIN,
                   root=ROOT)

    deploy_build_id('fireplace')


@task
def pre_update_latest_tag():
    current_tag_file = os.path.join(FIREPLACE, '.tag')
    latest_tag = helpers.git_latest_tag(FIREPLACE)
    with open(current_tag_file, 'r+') as f:
        if f.read() == latest_tag:
            print 'Environment is at %s' % latest_tag
        else:
            pre_update(latest_tag)
            f.seek(0)
            f.write(latest_tag)
            f.truncate()


@task
def build_package(package_env, build_dir=FIREPLACE):
    with lcd(build_dir):
        local(f'SERVER={package_env} node_modules/.bin/gulp package')


@task
def upload_package(fireplace_package, package_name):
    with lcd(ZAMBONI):
        local(
            f'{ZAMBONI_PYTHON} manage.py upload_new_marketplace_package {package_name} {fireplace_package} '
        )


def fireplace_package(env, build_dir):
    return f'{build_dir}/package/builds/_{env}.zip'


@task
def deploy_build_id(app):
    with lcd(ZAMBONI):
        local(f'{ZAMBONI_PYTHON} manage.py deploy_build_id {app}')
